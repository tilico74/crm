from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Servico, Unidade
from apps.clientes.models import Cliente, EnderecoCliente
from apps.financeiro.models import CondicaoPagamento, TipoPagamento
from apps.usuarios.models import Funcionario, Grupo, Usuario
from apps.vendas.calculo import calcular_item, calcular_orcamento, gerar_parcelas
from apps.vendas.models import Orcamento

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    usuario = Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))
    api = APIClient()
    api.force_authenticate(usuario)
    return api, usuario


@pytest.fixture
def base():
    m2 = Unidade.objects.create(sigla="M²", nome="Metro quadrado")
    produto = Produto.objects.create(descricao="Instalação rede proteção 5x5cm", unidade=m2, preco_venda=Decimal("78.19"))
    servico = Servico.objects.create(nome="Visita técnica", unidade=Unidade.objects.get(pk=1), preco_venda=Decimal("50"))
    cliente = Cliente.objects.create(nome="Ana Teste")
    endereco = EnderecoCliente.objects.create(cliente=cliente, logradouro="Rua A", padrao=True)
    return {"m2": m2, "produto": produto, "servico": servico, "cliente": cliente, "endereco": endereco}


def item(produto, quantidade, unitario="78.19", **extra):
    return {"produto": produto.id, "quantidade": quantidade, "valor_unitario": unitario, **extra}


def test_calculo_bate_com_o_orcamento_3874_da_marketup():
    itens = [calcular_item({"quantidade": q, "valor_unitario": "78.19"}) for q in ("2.99", "2.47", "2.47")]
    assert [i["total"] for i in itens] == [Decimal("233.79"), Decimal("193.13"), Decimal("193.13")]
    totais = calcular_orcamento({"desconto": "0.05"}, itens)
    assert totais["subtotal"] == Decimal("620.05") and totais["total"] == Decimal("620.00")
    pct = calcular_orcamento({"desconto_percentual": "10", "desconto_em_percentual": True, "frete": "30"}, itens)
    assert pct["desconto"] == Decimal("62.01") and pct["total"] == Decimal("588.04")


def test_parcelas_somam_o_valor_e_vencem_pela_condicao():
    parcelas = gerar_parcelas(Decimal("100"), 3, date(2026, 11, 8), primeira_parcela=30)
    assert [p.valor for p in parcelas] == [Decimal("33.34"), Decimal("33.33"), Decimal("33.33")]
    assert [p.vencimento for p in parcelas] == [date(2026, 12, 8), date(2027, 1, 7), date(2027, 2, 6)]


def test_sem_login_401_e_sem_permissao_403():
    assert APIClient().get("/api/orcamentos").status_code == 401
    api = APIClient()
    api.force_authenticate(Usuario.objects.create_user("x", password="x", grupo=Grupo.objects.create(nome="Nada")))
    assert api.get("/api/orcamentos").status_code == 403


def test_cria_com_totais_calculados_no_servidor(admin, base):
    api, usuario = admin
    dados = {
        "cliente": base["cliente"].id, "endereco_faturamento": base["endereco"].id, "endereco_entrega": base["endereco"].id,
        "emissao": "2026-11-06", "validade": "2026-11-21", "entrega": "2026-11-16", "desconto": "0.05",
        "subtotal": "1", "total": "1",  # ignorados: o servidor calcula
        "itens": [
            item(base["produto"], "2.99", observacao="2,30 x 1,30"),
            item(base["produto"], "2.47", observacao="1,90 x 1,30"),
            item(base["produto"], "2.47", observacao="1,90 x 1,30"),
        ],
    }
    resposta = api.post("/api/orcamentos", dados, format="json")
    assert resposta.status_code == 201, resposta.data
    o = resposta.data
    assert o["status"] == 1 and o["subtotal"] == "620.05" and o["total"] == "620.00"
    assert o["itens"][0]["descricao"] == "Instalação rede proteção 5x5cm" and o["itens"][0]["unidade_sigla"] == "M²"
    assert [i["ordem"] for i in o["itens"]] == [1, 2, 3]
    assert Orcamento.objects.get(pk=o["id"]).criado_por == usuario


def test_regras_de_validacao(admin, base):
    api, _ = admin
    outro = EnderecoCliente.objects.create(cliente=Cliente.objects.create(nome="Outro"), logradouro="Rua B")
    comum = {"cliente": base["cliente"].id, "emissao": "2026-11-06"}
    assert "endereco_entrega" in api.post("/api/orcamentos", {**comum, "endereco_entrega": outro.id}, format="json").data
    assert "validade" in api.post("/api/orcamentos", {**comum, "validade": "2026-11-01"}, format="json").data
    assert "itens" in api.post("/api/orcamentos", {**comum, "itens": [item(base["produto"], "1", desconto="100")]}, format="json").data
    assert "desconto" in api.post("/api/orcamentos", {**comum, "itens": [item(base["produto"], "1")], "desconto": "500"}, format="json").data
    base["cliente"].bloqueado = True
    base["cliente"].save()
    assert "cliente" in api.post("/api/orcamentos", comum, format="json").data


def test_parcelas_precisam_somar_o_total(admin, base):
    api, _ = admin
    tipo = TipoPagamento.objects.create(descricao="PIX")
    condicao = CondicaoPagamento.objects.create(tipo=tipo, descricao="2x", parcelas=2, intervalo=30)
    geradas = api.get(f"/api/orcamentos/gerar-parcelas?condicao={condicao.id}&valor=100&base=2026-11-08").data
    assert [p["valor"] for p in geradas] == ["50.00", "50.00"] and geradas[1]["vencimento"] == date(2026, 12, 8)
    comum = {"cliente": base["cliente"].id, "emissao": "2026-11-08", "itens": [item(base["servico"], "2", "50")]}
    comum["itens"][0] = {"servico": base["servico"].id, "quantidade": "2", "valor_unitario": "50"}
    ok = api.post("/api/orcamentos", {**comum, "parcelas": geradas}, format="json")
    assert ok.status_code == 201, ok.data
    assert len(ok.data["parcelas"]) == 2 and ok.data["parcelas"][0]["tipo_pagamento_nome"] == "PIX"
    errado = api.post("/api/orcamentos", {**comum, "parcelas": geradas[:1]}, format="json")
    assert "parcelas" in errado.data


def test_cancelar_trava_e_copiar_gera_novo(admin, base):
    api, _ = admin
    o = api.post("/api/orcamentos", {"cliente": base["cliente"].id, "emissao": "2026-01-01", "itens": [item(base["produto"], "1")]}, format="json").data
    copia = api.post(f"/api/orcamentos/{o['id']}/copiar").data
    assert copia["id"] != o["id"] and copia["status"] == 1 and len(copia["itens"]) == 1 and copia["emissao"] != "2026-01-01"
    cancelado = api.patch(f"/api/orcamentos/{o['id']}/cancelar").data
    assert cancelado["status"] == 4 and cancelado["data_cancelamento"]
    assert api.patch(f"/api/orcamentos/{o['id']}", {"frete": "10"}, format="json").status_code == 400
    assert api.delete(f"/api/orcamentos/{o['id']}").status_code == 400


def test_novo_traz_prazos_e_vendedor_logado(admin):
    api, usuario = admin
    Funcionario.objects.create(nome="Nelson", vendedor=True, usuario=usuario)
    padrao = api.get("/api/orcamentos/novo").data
    assert (padrao["validade"] - padrao["emissao"]).days == 15 and (padrao["entrega"] - padrao["emissao"]).days == 10
    assert padrao["vendedor"] is not None
    assert [v["nome"] for v in api.get("/api/orcamentos/vendedores").data] == ["Nelson"]


def test_filtros_da_listagem(admin, base):
    api, _ = admin
    api.post("/api/orcamentos", {"cliente": base["cliente"].id, "emissao": "2026-11-06", "itens": [item(base["produto"], "2")]}, format="json")
    outro = Cliente.objects.create(nome="Bruno Teste")
    api.post("/api/orcamentos", {"cliente": outro.id, "emissao": "2026-10-01"}, format="json")
    assert api.get("/api/orcamentos?status=1").data["count"] == 2
    assert api.get("/api/orcamentos?cliente=ana").data["count"] == 1
    assert api.get("/api/orcamentos?emissao_de=2026-11-01").data["count"] == 1
    assert api.get("/api/orcamentos?produto=rede").data["count"] == 1
    assert api.get("/api/orcamentos?valor_de=100").data["results"][0]["cliente_nome"] == "Ana Teste"


def test_venda_fracionada_usa_a_unidade_da_fracao(admin, base):
    api, _ = admin
    metro = Unidade.objects.create(sigla="MT", nome="Metro teste")
    rolo = Produto.objects.create(
        descricao="Rede em rolo", unidade=Unidade.objects.get(pk=1), preco_venda=Decimal("500"),
        fragmentacao_quantidade=Decimal("50"), fragmentacao_unidade=metro, fragmentacao_preco=Decimal("12"),
    )
    comum = {"cliente": base["cliente"].id, "emissao": "2026-11-08"}
    fracao = api.post("/api/orcamentos", {**comum, "itens": [item(rolo, "3.5", "12", unidade=metro.id, fragmentado=False)]}, format="json")
    assert fracao.status_code == 201, fracao.data
    linha = fracao.data["itens"][0]
    assert linha["fragmentado"] is True and linha["unidade_sigla"] == "MT" and fracao.data["total"] == "42.00"
    inteiro = api.post("/api/orcamentos", {**comum, "itens": [item(rolo, "1", "500", fragmentado=True)]}, format="json").data
    assert inteiro["itens"][0]["fragmentado"] is False and inteiro["itens"][0]["unidade_sigla"] == "UN"
    # Unidade que não é nem a do produto nem a da fração: recusada.
    errado = api.post("/api/orcamentos", {**comum, "itens": [item(base["produto"], "1", unidade=metro.id)]}, format="json")
    assert errado.status_code == 400 and "unidade inválida" in str(errado.data)


def test_comentarios_salvos_sem_mexer_nos_itens(admin, base):
    api, _ = admin
    o = api.post("/api/orcamentos", {"cliente": base["cliente"].id, "emissao": "2026-11-08", "itens": [item(base["produto"], "2")]}, format="json").data
    resposta = api.patch(f"/api/orcamentos/{o['id']}", {"observacao": "Cliente pediu rede preta"}, format="json")
    assert resposta.status_code == 200, resposta.data
    assert resposta.data["observacao"] == "Cliente pediu rede preta"
    assert resposta.data["total"] == o["total"] and len(resposta.data["itens"]) == 1


def test_orcamento_exige_cliente(admin):
    api, _ = admin
    resposta = api.post("/api/orcamentos", {"emissao": "2026-11-08"}, format="json")
    assert resposta.status_code == 400 and "Identifique o cliente" in str(resposta.data["cliente"])


def test_cliente_novo_ganha_o_limite_dos_parametros_de_venda(admin):
    from apps.vendas.models import ParametrosVenda

    api, _ = admin
    parametros = ParametrosVenda.atual()
    parametros.limite_credito_novos = Decimal("1000")
    parametros.save()
    rapido = api.post("/api/clientes", {"nome": "cliente do orçamento"}, format="json").data
    assert rapido["limite_credito"] == "1000.00" and rapido["credito"]["disponivel"] == Decimal("1000.00")
    assert api.post("/api/clientes", {"nome": "Outro", "limite_credito": "0"}, format="json").data["limite_credito"] == "0.00"


def test_arredondamento_das_parcelas_igual_ao_da_marketup():
    # 620,00 em 3x no cheque "30, 90 e 150 dias" (visto na MarketUP em 08/11/2026).
    parcelas = gerar_parcelas(Decimal("620"), 3, date(2026, 11, 8), primeira_parcela=30, intervalo=60)
    assert [p.valor for p in parcelas] == [Decimal("206.66"), Decimal("206.67"), Decimal("206.67")]
    assert [p.vencimento.isoformat() for p in parcelas] == ["2026-12-08", "2027-02-06", "2027-04-07"]


def test_parcela_zerada_e_recusada(admin, base):
    api, _ = admin
    tipo = TipoPagamento.objects.create(descricao="PIX")
    comum = {"cliente": base["cliente"].id, "emissao": "2026-11-08", "itens": [{"servico": base["servico"].id, "quantidade": "1", "valor_unitario": "50"}]}
    parcelas = [
        {"numero": 1, "quantidade": 2, "vencimento": "2026-11-08", "valor": "50.00", "tipo_pagamento": tipo.id},
        {"numero": 2, "quantidade": 2, "vencimento": "2026-12-08", "valor": "0", "tipo_pagamento": tipo.id},
    ]
    resposta = api.post("/api/orcamentos", {**comum, "parcelas": parcelas}, format="json")
    assert resposta.status_code == 400 and "valor inválido" in str(resposta.data["parcelas"])
