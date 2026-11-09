from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Servico, Unidade
from apps.clientes.models import Cliente, EnderecoCliente
from apps.financeiro.models import CondicaoPagamento, ContaCorrente, ContaReceber, LancamentoCaixa, TipoPagamento
from apps.usuarios.models import Funcionario, Grupo, Usuario
from apps.vendas.models import Orcamento, ParametrosVenda, Pedido

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
    produto = Produto.objects.create(descricao="Rede de proteção", unidade=m2, preco_venda=Decimal("100"))
    servico = Servico.objects.create(nome="Visita técnica", unidade=Unidade.objects.get(pk=1), preco_venda=Decimal("50"))
    cliente = Cliente.objects.create(nome="Ana Teste", limite_credito=Decimal("1000"), email="ana@exemplo.com")
    endereco = EnderecoCliente.objects.create(cliente=cliente, logradouro="Rua A", padrao=True)
    pix = TipoPagamento.objects.create(descricao="PIX")
    a_vista = CondicaoPagamento.objects.create(tipo=pix, descricao="À vista", parcelas=1)
    tres = CondicaoPagamento.objects.create(tipo=pix, descricao="3x", parcelas=3, primeira_parcela=30, intervalo=30)
    caixa = ContaCorrente.objects.create(id=1, nome="Caixa", interna=True)
    return {"produto": produto, "servico": servico, "cliente": cliente, "endereco": endereco, "pix": pix, "a_vista": a_vista, "tres": tres, "caixa": caixa}


def hoje():
    return timezone.localdate()


def pedido_pronto(api, base, valor="300", condicao=None, **extra):
    """Pedido Novo com cliente, endereços, 3 m² a R$ 100 e as parcelas da condição."""
    condicao = condicao or base["a_vista"]
    parcelas = api.get(f"/api/pedidos/gerar-parcelas?condicao={condicao.id}&valor={valor}").data
    dados = {
        "cliente": base["cliente"].id, "endereco_faturamento": base["endereco"].id, "endereco_entrega": base["endereco"].id,
        "emissao": hoje().isoformat(), "itens": [{"produto": base["produto"].id, "quantidade": "3", "valor_unitario": "100"}],
        "parcelas": parcelas, **extra,
    }
    resposta = api.post("/api/pedidos", dados, format="json")
    assert resposta.status_code == 201, resposta.data
    return resposta.data


def test_permissao():
    assert APIClient().get("/api/pedidos").status_code == 401
    api = APIClient()
    api.force_authenticate(Usuario.objects.create_user("x", password="x", grupo=Grupo.objects.create(nome="Nada")))
    assert api.get("/api/pedidos").status_code == 403


def test_novo_usa_entrega_para_pedido(admin):
    api, usuario = admin
    Funcionario.objects.create(nome="Nelson", vendedor=True, usuario=usuario)
    padrao = api.get("/api/pedidos/novo").data
    assert (padrao["entrega"] - padrao["emissao"]).days == ParametrosVenda.atual().venda_entrega_pedido
    assert padrao["vendedor"] is not None and "validade" not in padrao


def test_gerar_pedido_do_orcamento_conclui_o_orcamento(admin, base):
    api, _ = admin
    orcamento = api.post("/api/orcamentos", {
        "cliente": base["cliente"].id, "emissao": "2026-11-01", "observacao": "rede preta",
        "itens": [{"produto": base["produto"].id, "quantidade": "2", "valor_unitario": "100", "observacao": "2 x 1"}],
    }, format="json").data
    copia = api.get(f"/api/pedidos/novo?orcamento={orcamento['id']}").data
    assert copia["orcamento"] == orcamento["id"] and copia["total"] == "200.00" and "id" not in copia
    assert copia["itens"][0]["observacao"] == "2 x 1" and "id" not in copia["itens"][0]
    # Só ao gravar o pedido o orçamento muda (como "Gerar pedido" da MarketUP).
    assert Orcamento.objects.get(pk=orcamento["id"]).status == Orcamento.Status.NOVO
    pedido = api.post("/api/pedidos", copia, format="json")
    assert pedido.status_code == 201, pedido.data
    o = Orcamento.objects.get(pk=orcamento["id"])
    assert o.status == Orcamento.Status.CONCLUIDO and o.pedido_id == pedido.data["id"] and o.data_pedido
    # Orçamento concluído não gera outro pedido.
    assert api.get(f"/api/pedidos/novo?orcamento={orcamento['id']}").status_code == 400
    assert api.post("/api/pedidos", copia, format="json").status_code == 400
    # Cancelar o pedido não reabre o orçamento (orçamento 3736 → pedido 2881 na MarketUP).
    api.post(f"/api/pedidos/{pedido.data['id']}/cancelar", {}, format="json")
    assert Orcamento.objects.get(pk=orcamento["id"]).status == Orcamento.Status.CONCLUIDO


def test_concluir_gera_contas_a_receber(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base, condicao=base["tres"])
    assert p["situacao"] == "novo"
    concluido = api.post(f"/api/pedidos/{p['id']}/concluir")
    assert concluido.status_code == 200, concluido.data
    d = concluido.data
    assert d["status"] == 2 and d["data_faturamento"] and d["situacao"] == "faturado"
    assert d["entrega_status"] == 1 and d["financeiro_status"] == 1 and d["saldo_receber"] == "300.00"
    contas = ContaReceber.objects.filter(origem=7, origem_id=p["id"]).order_by("parcela")
    assert [(c.parcela, c.parcelas, c.valor, c.saldo) for c in contas] == [
        (1, 3, Decimal("100.00"), Decimal("100.00")), (2, 3, Decimal("100.00"), Decimal("100.00")), (3, 3, Decimal("100.00"), Decimal("100.00"))
    ]
    assert contas[0].descricao == f"Pedido de Venda Nº {p['id']}" and contas[0].cliente_id == base["cliente"].id
    assert [x["conta_receber"] for x in d["parcelas"]] == [c.id for c in contas]
    # Concluído não se altera nem conclui de novo.
    assert api.patch(f"/api/pedidos/{p['id']}", {"frete": "1"}, format="json").status_code == 400
    assert api.post(f"/api/pedidos/{p['id']}/concluir").status_code == 400
    # O crédito utilizado do cliente passa a contar as parcelas em aberto.
    assert api.get(f"/api/clientes/{base['cliente'].id}").data["credito"]["utilizado"] == Decimal("300.00")


def test_validacoes_do_concluir(admin, base):
    api, _ = admin
    sem_endereco = pedido_pronto(api, base, endereco_entrega=None)
    erro = api.post(f"/api/pedidos/{sem_endereco['id']}/concluir")
    assert erro.status_code == 400 and "endereço de entrega" in erro.data["detail"]
    sem_parcela = pedido_pronto(api, base, parcelas=[])
    assert "Forma/Condição de pagamento inválida" in api.post(f"/api/pedidos/{sem_parcela['id']}/concluir").data["detail"]
    vencida = pedido_pronto(api, base, emissao=(hoje() + timedelta(days=5)).isoformat())
    assert "parcelas vencidas" in api.post(f"/api/pedidos/{vencida['id']}/concluir").data["detail"]


def test_limite_de_credito_so_conta_o_a_prazo(admin, base):
    api, _ = admin
    base["cliente"].limite_credito = Decimal("150")
    base["cliente"].save()
    # À vista (vence na emissão) não usa limite.
    a_vista = pedido_pronto(api, base)
    assert api.post(f"/api/pedidos/{a_vista['id']}/concluir").status_code == 200
    a_prazo = pedido_pronto(api, base, condicao=base["tres"])
    erro = api.post(f"/api/pedidos/{a_prazo['id']}/concluir")
    assert erro.status_code == 400 and "limite de crédito disponível" in erro.data["detail"]
    assert "R$ -150.00" in erro.data["detail"] and "R$ 300.00" in erro.data["detail"]  # já deve 300 do à vista
    ParametrosVenda.objects.filter(pk=1).update(utilizar_limite_credito=False)
    assert api.post(f"/api/pedidos/{a_prazo['id']}/concluir").status_code == 200


def test_receber_recibo_estorno_e_status_de_pagamento(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base, condicao=base["tres"])
    d = api.post(f"/api/pedidos/{p['id']}/concluir").data
    conta = d["parcelas"][0]["conta_receber"]
    assert api.get(f"/api/contas-receber/{conta}/recibo").status_code == 400  # sem recebimento
    excesso = api.post(f"/api/contas-receber/{conta}/receber", {"data": hoje().isoformat(), "conta_corrente": base["caixa"].id, "valor": "100.01"}, format="json")
    assert excesso.status_code == 400 and "excede" in str(excesso.data)
    r = api.post(f"/api/contas-receber/{conta}/receber", {"data": hoje().isoformat(), "conta_corrente": base["caixa"].id, "valor": "102", "juros": "2", "tipo_pagamento": base["pix"].id}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["saldo"] == "0.00" and r.data["situacao"] == "recebida"
    assert LancamentoCaixa.objects.filter(credito=True, valor=Decimal("102")).exists()
    pedido = api.get(f"/api/pedidos/{p['id']}").data
    assert pedido["financeiro_status"] == 3 and pedido["saldo_receber"] == "200.00" and pedido["parcelas"][0]["saldo"] == "0.00"
    recibo = api.get(f"/api/contas-receber/{conta}/recibo").data
    assert recibo["total"] == "102.00" and recibo["juros"] == "2.00" and recibo["recebi_de"] == "Ana Teste"
    assert recibo["referente"] == f"PEDIDO {p['id']} - PARCELA 1 / 3" and recibo["data"] == hoje()
    # Estorno (X vermelho): o saldo volta e o caixa recebe a saída.
    rid = r.data["recebimentos"][0]["id"]
    e = api.post(f"/api/contas-receber/{conta}/recebimentos/{rid}/estornar")
    assert e.status_code == 200 and e.data["saldo"] == "100.00"
    assert LancamentoCaixa.objects.filter(credito=False, valor=Decimal("102")).exists()
    assert api.get(f"/api/pedidos/{p['id']}").data["financeiro_status"] == 1
    # Tudo recebido + entregue = Concluído.
    for parcela in api.get(f"/api/pedidos/{p['id']}").data["parcelas"]:
        api.post(f"/api/contas-receber/{parcela['conta_receber']}/receber", {"data": hoje().isoformat(), "conta_corrente": base["caixa"].id, "valor": "100"}, format="json")
    pago = api.get(f"/api/pedidos/{p['id']}").data
    assert pago["financeiro_status"] == 2 and pago["situacao"] == "faturado"  # falta entregar
    entregue = api.post(f"/api/pedidos/{p['id']}/entregar", {}, format="json").data
    assert entregue["entrega_status"] == 2 and entregue["situacao"] == "concluido" and entregue["itens"][0]["entregue"] == "3.000"
    assert api.post(f"/api/pedidos/{p['id']}/entregar", {}, format="json").status_code == 400


def test_atrasados_saem_da_data(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base, condicao=base["tres"])
    api.post(f"/api/pedidos/{p['id']}/concluir")
    ContaReceber.objects.filter(origem_id=p["id"], parcela=1).update(vencimento=hoje() - timedelta(days=1))
    Pedido.objects.filter(pk=p["id"]).update(entrega=hoje() - timedelta(days=1))
    d = api.get(f"/api/pedidos/{p['id']}").data
    assert d["financeiro_status"] == 4 and d["entrega_status"] == 4
    assert api.get("/api/pedidos?financeiro=4").data["count"] == 1
    assert api.get("/api/pedidos?financeiro=1").data["count"] == 0
    assert api.get("/api/pedidos?entrega=4").data["count"] == 1
    assert api.get("/api/pedidos?entrega=1").data["count"] == 0


def test_cancelar_estorna_o_recebido_e_tira_as_contas(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base, condicao=base["tres"])
    d = api.post(f"/api/pedidos/{p['id']}/concluir").data
    api.post(f"/api/contas-receber/{d['parcelas'][0]['conta_receber']}/receber", {"data": hoje().isoformat(), "conta_corrente": base["caixa"].id, "valor": "100"}, format="json")
    previa = api.get(f"/api/pedidos/{p['id']}/cancelamento").data
    assert previa["valor_recebido"] == "100.00"
    assert api.post(f"/api/pedidos/{p['id']}/cancelar", {"valor_estorno": "150"}, format="json").status_code == 400
    c = api.post(f"/api/pedidos/{p['id']}/cancelar", {"valor_estorno": "100", "tipo_pagamento": base["pix"].id, "conta_corrente": base["caixa"].id}, format="json")
    assert c.status_code == 200, c.data
    assert c.data["status"] == 7 and c.data["entrega_status"] == 7 and c.data["financeiro_status"] == 7 and c.data["situacao"] == "cancelado"
    assert c.data["parcelas"] == []  # como o pedido 2881 da MarketUP
    assert not ContaReceber.objects.filter(origem_id=p["id"], cancelada=False).exists()
    assert LancamentoCaixa.objects.filter(credito=False, valor=Decimal("100"), origem_id=p["id"]).exists()
    assert api.get(f"/api/clientes/{base['cliente'].id}").data["credito"]["utilizado"] == 0
    assert api.post(f"/api/pedidos/{p['id']}/cancelar", {}, format="json").status_code == 400


def test_pedido_novo_cancela_direto_e_so_novo_se_exclui(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base)
    assert api.get(f"/api/pedidos/{p['id']}/cancelamento").data["valor_recebido"] == "0.00"
    outro = pedido_pronto(api, base)
    assert api.delete(f"/api/pedidos/{outro['id']}").status_code == 204
    assert api.post(f"/api/pedidos/{p['id']}/cancelar", {}, format="json").data["status"] == 7
    assert api.delete(f"/api/pedidos/{p['id']}").status_code == 400


def test_so_servico_ja_nasce_entregue_e_copiar(admin, base):
    api, _ = admin
    parcelas = api.get(f"/api/pedidos/gerar-parcelas?condicao={base['a_vista'].id}&valor=50").data
    p = api.post("/api/pedidos", {
        "cliente": base["cliente"].id, "endereco_faturamento": base["endereco"].id, "endereco_entrega": base["endereco"].id,
        "emissao": hoje().isoformat(), "itens": [{"servico": base["servico"].id, "quantidade": "1", "valor_unitario": "50"}], "parcelas": parcelas,
    }, format="json").data
    d = api.post(f"/api/pedidos/{p['id']}/concluir").data
    assert d["entrega_status"] == 2
    copia = api.post(f"/api/pedidos/{p['id']}/copiar").data
    assert copia["status"] == 1 and copia["parcelas"] == [] and len(copia["itens"]) == 1 and copia["orcamento"] is None


def test_listagem_e_filtros(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base)
    pedido_pronto(api, base)
    api.post(f"/api/pedidos/{p['id']}/concluir")
    lista = api.get("/api/pedidos").data
    assert lista["count"] == 2
    linha = next(x for x in lista["results"] if x["id"] == p["id"])
    assert linha["situacao"] == "faturado" and linha["financeiro_status"] == 1 and linha["data_faturamento"]
    assert api.get("/api/pedidos?status=2").data["count"] == 1
    assert api.get(f"/api/pedidos?faturamento_de={hoje().isoformat()}").data["count"] == 1
    assert api.get("/api/pedidos?cliente=ana&produto=rede").data["count"] == 2


def test_vendedor_logado_vem_pre_selecionado(admin, base):
    api, usuario = admin
    nelson = Funcionario.objects.create(nome="Nelson", vendedor=True, usuario=usuario)
    esther = Funcionario.objects.create(nome="Esther", vendedor=True)
    Funcionario.objects.create(nome="Sem venda")
    assert [v["nome"] for v in api.get("/api/pedidos/vendedores").data] == ["Esther", "Nelson"]
    assert api.get("/api/pedidos/novo").data["vendedor"] == nelson.id
    assert api.get("/api/orcamentos/novo").data["vendedor"] == nelson.id
    # Do orçamento: o vendedor dele passa para o pedido; sem vendedor, entra o logado.
    com = api.post("/api/orcamentos", {"cliente": base["cliente"].id, "emissao": "2026-11-08", "vendedor": esther.id}, format="json").data
    sem = api.post("/api/orcamentos", {"cliente": base["cliente"].id, "emissao": "2026-11-08", "vendedor": None}, format="json").data
    assert api.get(f"/api/pedidos/novo?orcamento={com['id']}").data["vendedor"] == esther.id
    copia = api.get(f"/api/pedidos/novo?orcamento={sem['id']}").data
    assert copia["vendedor"] == nelson.id and copia["vendedor_nome"] == "Nelson"
    # Vendedor bloqueado não vem como padrão.
    Funcionario.objects.filter(pk=nelson.id).update(bloqueado=True)
    assert api.get("/api/pedidos/novo").data["vendedor"] is None


def test_carga_dos_vendedores_da_marketup(tmp_path):
    import json

    from django.core.management import call_command

    arquivo = tmp_path / "v.json"
    arquivo.write_text(json.dumps([{"EmployeeID": 25, "OfficialName": "cristian da silva jucoski"}, {"EmployeeID": 1142, "OfficialName": "Nelson X"}]), encoding="utf-8")
    call_command("importar_vendedores", str(arquivo))
    call_command("importar_vendedores", str(arquivo))  # recarga não duplica
    assert list(Funcionario.objects.order_by("id").values_list("id", "nome", "vendedor")) == [(25, "Cristian da Silva Jucoski", True), (1142, "Nelson X", True)]
    assert Funcionario.objects.create(nome="Novo").id == 1143


def test_recebimento_e_estorno_exigem_conta_corrente(admin, base):
    api, _ = admin
    p = pedido_pronto(api, base)
    d = api.post(f"/api/pedidos/{p['id']}/concluir").data
    conta = d["parcelas"][0]["conta_receber"]
    sem = api.post(f"/api/contas-receber/{conta}/receber", {"data": hoje().isoformat(), "valor": "300"}, format="json")
    assert sem.status_code == 400 and "conta corrente" in str(sem.data["conta_corrente"])
    inativa = ContaCorrente.objects.create(nome="Banco antigo", ativo=False)
    assert api.post(f"/api/contas-receber/{conta}/receber", {"data": hoje().isoformat(), "valor": "300", "conta_corrente": inativa.id}, format="json").status_code == 400
    ok = api.post(f"/api/contas-receber/{conta}/receber", {"data": hoje().isoformat(), "valor": "300", "conta_corrente": base["caixa"].id}, format="json")
    assert ok.status_code == 200 and ok.data["recebimentos"][0]["conta_corrente_nome"] == "Caixa"
    assert LancamentoCaixa.objects.get(credito=True, origem_id=p["id"]).conta_corrente_id == base["caixa"].id
    # Cancelar com estorno: precisa dizer de qual conta sai o dinheiro.
    sem_conta = api.post(f"/api/pedidos/{p['id']}/cancelar", {"valor_estorno": "300"}, format="json")
    assert sem_conta.status_code == 400 and "conta_corrente" in sem_conta.data
    cancelado = api.post(f"/api/pedidos/{p['id']}/cancelar", {"valor_estorno": "300", "conta_corrente": base["caixa"].id}, format="json")
    assert cancelado.status_code == 200
    assert LancamentoCaixa.objects.get(credito=False, origem_id=p["id"]).conta_corrente_id == base["caixa"].id
