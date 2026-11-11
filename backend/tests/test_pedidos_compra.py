from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Unidade
from apps.compras.models import PedidoCompra
from apps.core.models import Empresa, EnderecoEmpresa
from apps.estoque.models import Movimentacao, Saldo
from apps.financeiro.models import CondicaoPagamento, ContaCorrente, ContaGerencial, ContaPagar, LancamentoCaixa, TipoPagamento
from apps.usuarios.models import Grupo, Usuario

pytestmark = pytest.mark.django_db


def hoje(dias=0):
    return (timezone.localdate() + timedelta(days=dias)).isoformat()


@pytest.fixture
def cp():
    api = APIClient()
    api.force_authenticate(Usuario.objects.create_user("comprador", password="x", grupo=Grupo.objects.get(nome="Administrador")))
    empresa = Empresa.atual()
    for tipo in ("faturamento", "entregas"):
        EnderecoEmpresa.objects.create(empresa=empresa, tipo=tipo, logradouro="Rua José Pedro Correia Filho", numero="634", cidade="Palhoça", uf="SC", cep="88138-152")
    un = Unidade.objects.get(pk=1)
    fornecedor = api.post("/api/fornecedores", {"tipo_pessoa": "J", "nome": "ProtectGate LTDA"}, format="json").data
    pix = TipoPagamento.objects.create(descricao="PIX")
    return {
        "api": api,
        "fornecedor": fornecedor["id"],
        "rede": Produto.objects.create(descricao="Rede 5x5", unidade=un, preco_venda=Decimal("100"), preco_custo=Decimal("40"), movimenta_estoque=True),
        "fita": Produto.objects.create(descricao="Fita", unidade=un, preco_venda=Decimal("10"), preco_custo=Decimal("2")),
        "compras": ContaGerencial.objects.create(id=58, nome="Mercadoria para Revenda", tipo="S", classificacao_dre=""),
        "caixa": ContaCorrente.objects.create(id=1, nome="Caixa", interna=True),
        "cond": CondicaoPagamento.objects.create(tipo=pix, descricao="À vista", parcelas=1),
        "cond2": CondicaoPagamento.objects.create(tipo=pix, descricao="2x", parcelas=2, primeira_parcela=30, intervalo=30),
        "pix": pix,
    }


def criar(cp, **extra):
    api = cp["api"]
    novo = api.get("/api/pedidos-compra/novo").data
    corpo = {
        **{k: v for k, v in novo.items() if k.startswith(("fat_", "ent_"))},
        "fornecedor": cp["fornecedor"], "emissao": hoje(), "previsao": hoje(5), "conta_gerencial": 58,
        "itens": [
            {"produto": cp["rede"].id, "quantidade": "10", "valor_unitario": "45"},
            {"produto": cp["fita"].id, "quantidade": "2", "valor_unitario": "2", "desconto": "1"},
        ],
        "desconto": "3", "frete": "10", **extra,
    }
    return api.post("/api/pedidos-compra", corpo, format="json")


def parcelas(cp, total, cond="cond"):
    return cp["api"].get(f"/api/pedidos-compra/gerar-parcelas?condicao={cp[cond].id}&valor={total}&conta_gerencial=58").data


def test_novo_salvar_e_totais_como_a_marketup(cp):
    api = cp["api"]
    novo = api.get("/api/pedidos-compra/novo").data
    assert novo["fat_logradouro"] == "Rua José Pedro Correia Filho" and novo["conta_gerencial"] == 58
    r = criar(cp)
    assert r.status_code == 201, r.data
    # subtotal = Σ totais dos itens (450 + 4 − 1); total = subtotal − desconto geral + frete.
    assert (r.data["subtotal"], r.data["total"]) == ("453.00", "460.00")
    assert r.data["situacao"] == "novo" and r.data["recebimento_lista"] == "Pendente"
    # Datas: emissão no futuro ou recebimento antes da emissão.
    assert "Data de entrega ou de emissão inválida!" in str(criar(cp, emissao=hoje(1)).data)
    assert "Data de entrega ou de emissão inválida!" in str(criar(cp, previsao=hoje(-1)).data)
    assert "fornecedor" in criar(cp, fornecedor=None).data
    # Parcelas com soma diferente do total.
    errado = parcelas(cp, "100")
    assert "diferente do valor total do pedido" in str(criar(cp, parcelas=errado).data)


def test_concluir_gera_contas_a_pagar_e_atualiza_custo(cp):
    api = cp["api"]
    pedido = criar(cp).data
    pid = pedido["id"]
    falta = api.post(f"/api/pedidos-compra/{pid}/concluir", {}, format="json")
    assert falta.status_code == 400 and falta.data["detail"] == "PEDIDO NÃO FATURADO! Forma/Condição de pagamento inválida."
    api.patch(f"/api/pedidos-compra/{pid}", {"sem_endereco_faturamento": False, "fat_logradouro": ""}, format="json")
    assert "Endereço de faturamento" in api.post(f"/api/pedidos-compra/{pid}/concluir", {}, format="json").data["detail"]
    api.patch(f"/api/pedidos-compra/{pid}", {"sem_endereco_faturamento": True, "parcelas": parcelas(cp, "460", "cond2")}, format="json")
    custos = api.get(f"/api/pedidos-compra/{pid}/custos").data
    assert custos == [{"produto": cp["rede"].id, "descricao": "Rede 5x5", "de": "40.00", "para": "45.00"}]
    r = api.post(f"/api/pedidos-compra/{pid}/concluir", {"atualizar_custo": True}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["status"] == 2 and r.data["situacao"] == "faturado" and r.data["recebimento_status"] == "Pendente"
    contas = list(ContaPagar.objects.filter(origem=6, origem_id=pid).order_by("parcela"))
    assert [(c.parcela, c.parcelas, c.valor, c.conta_gerencial_id, c.fornecedor_id, c.descricao) for c in contas] == [
        (1, 2, Decimal("230.00"), 58, cp["fornecedor"], f"Pedido de Compra Nº {pid}"),
        (2, 2, Decimal("230.00"), 58, cp["fornecedor"], f"Pedido de Compra Nº {pid}"),
    ]
    assert all(c.parcela_compra_id for c in contas)
    cp["rede"].refresh_from_db()
    assert cp["rede"].preco_custo == Decimal("45.00")
    # Faturado: só os comentários mudam.
    assert api.patch(f"/api/pedidos-compra/{pid}", {"frete": "0"}, format="json").status_code == 400
    assert api.patch(f"/api/pedidos-compra/{pid}", {"observacao": "ok"}, format="json").status_code == 200


def faturado(cp, cond="cond"):
    api = cp["api"]
    pid = criar(cp).data["id"]
    api.patch(f"/api/pedidos-compra/{pid}", {"parcelas": parcelas(cp, "460", cond)}, format="json")
    api.post(f"/api/pedidos-compra/{pid}/concluir", {}, format="json")
    return pid


def saldo(produto):
    return Saldo.objects.filter(produto=produto, local_id=1).values_list("quantidade", flat=True).first() or Decimal(0)


def test_receber_parcial_com_nf_lote_e_estoque(cp):
    api = cp["api"]
    pid = faturado(cp)
    itens = {i["descricao"]: i["id"] for i in api.get(f"/api/pedidos-compra/{pid}").data["itens"]}
    demais = api.post(f"/api/pedidos-compra/{pid}/receber", {"data": hoje(), "itens": [{"item": itens["Rede 5x5"], "quantidade": "11"}]}, format="json")
    assert demais.status_code == 400
    venceu = api.post(f"/api/pedidos-compra/{pid}/receber", {"data": hoje(), "itens": [{"item": itens["Rede 5x5"], "quantidade": "1", "validade": hoje()}]}, format="json")
    assert "validade" in str(venceu.data)
    r = api.post(f"/api/pedidos-compra/{pid}/receber", {
        "data": hoje(), "nota_numero": "3612", "nota_serie": "1", "nota_emissao": hoje(),
        "itens": [{"item": itens["Rede 5x5"], "quantidade": "4", "lote": "L1", "validade": hoje(90)}, {"item": itens["Fita"], "quantidade": "2"}],
    }, format="json")
    assert r.status_code == 200, r.data
    assert r.data["recebimento_status"] == "Parcial" and r.data["nota_numero"] == "3612"
    assert saldo(cp["rede"]) == 4  # a fita não movimenta estoque
    mov = Movimentacao.objects.get(origem=4, origem_id=pid)
    assert mov.tipo == Movimentacao.Tipo.ENTRADA and mov.nota_numero == "3612" and mov.itens.get().lote == "L1"
    assert mov.itens.get().valor_unitario == Decimal("45.00")
    r = api.post(f"/api/pedidos-compra/{pid}/receber", {"data": hoje(), "itens": [{"item": itens["Rede 5x5"], "quantidade": "6"}]}, format="json")
    assert r.data["recebimento_status"] == "Total" and r.data["recebimento_lista"] == "Entregue" and saldo(cp["rede"]) == 10


def test_devolver_abate_saldo_e_estorna_o_excedente(cp):
    api = cp["api"]
    pid = faturado(cp)
    itens = {i["descricao"]: i["id"] for i in api.get(f"/api/pedidos-compra/{pid}").data["itens"]}
    api.post(f"/api/pedidos-compra/{pid}/receber", {"data": hoje(), "itens": [{"item": itens["Rede 5x5"], "quantidade": "10"}]}, format="json")
    conta = ContaPagar.objects.get(origem=6, origem_id=pid)
    # Paga 400 dos 460: saldo 60.
    api.patch(f"/api/contas-pagar/{conta.id}", {"novas_baixas": [{"data": hoje(), "conta_corrente": 1, "valor": "400"}]}, format="json")
    assert api.post(f"/api/pedidos-compra/{pid}/devolver", {"itens": [{"item": itens["Rede 5x5"], "devolver": "11"}]}, format="json").status_code == 400
    # Devolve 2 redes = 90,00: 60 abatem o saldo e 30 voltam ao caixa.
    sem_conta = api.post(f"/api/pedidos-compra/{pid}/devolver", {"itens": [{"item": itens["Rede 5x5"], "devolver": "2"}]}, format="json")
    assert "conta_corrente" in sem_conta.data
    r = api.post(f"/api/pedidos-compra/{pid}/devolver", {"conta_corrente": 1, "tipo_pagamento": cp["pix"].id, "itens": [{"item": itens["Rede 5x5"], "devolver": "2", "trocar": "1"}]}, format="json")
    assert r.status_code == 200, r.data
    conta.refresh_from_db()
    assert (conta.valor, conta.saldo) == (Decimal("400.00"), Decimal("0.00"))
    estorno = LancamentoCaixa.objects.get(origem=6, origem_id=pid, credito=True)
    assert estorno.valor == Decimal("30.00") and "ESTORNO DA DEVOLUÇÃO DO PEDIDO DE COMPRA" in estorno.descricao
    assert saldo(cp["rede"]) == 8
    item = next(i for i in r.data["itens"] if i["descricao"] == "Rede 5x5")
    assert (item["devolvido"], item["valor_devolvido"]) == ("2.000", "90.00")
    lista = api.get("/api/pedidos-compra/devolucoes").data
    assert lista[0]["pedido"] == pid and lista[0]["valor"] == "90.00" and lista[0]["valor_estorno"] == "30.00"


def test_cancelar_estorna_o_pago_e_tira_do_estoque(cp):
    api = cp["api"]
    pid = faturado(cp)
    itens = {i["descricao"]: i["id"] for i in api.get(f"/api/pedidos-compra/{pid}").data["itens"]}
    api.post(f"/api/pedidos-compra/{pid}/receber", {"data": hoje(), "itens": [{"item": itens["Rede 5x5"], "quantidade": "3"}]}, format="json")
    conta = ContaPagar.objects.get(origem=6, origem_id=pid)
    api.patch(f"/api/contas-pagar/{conta.id}", {"novas_baixas": [{"data": hoje(), "conta_corrente": 1, "valor": "100"}]}, format="json")
    assert api.get(f"/api/pedidos-compra/{pid}/cancelamento").data == {"valor_pago": "100.00", "itens_recebidos": 1}
    assert api.post(f"/api/pedidos-compra/{pid}/cancelar", {"valor_estorno": "150"}, format="json").status_code == 400
    r = api.post(f"/api/pedidos-compra/{pid}/cancelar", {"valor_estorno": "100", "conta_corrente": 1}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["status"] == 7 and r.data["situacao"] == "cancelado" and r.data["parcelas"] == []
    conta.refresh_from_db()
    assert conta.cancelada
    assert LancamentoCaixa.objects.get(origem=6, origem_id=pid, credito=True).valor == Decimal("100.00")
    assert saldo(cp["rede"]) == 0
    assert Movimentacao.objects.filter(origem=10, origem_id=pid).exists()
    assert api.post(f"/api/pedidos-compra/{pid}/cancelar", {}, format="json").status_code == 400


def test_status_da_lista_e_da_ficha(cp):
    api = cp["api"]
    pid = faturado(cp)
    PedidoCompra.objects.filter(pk=pid).update(previsao=timezone.localdate() - timedelta(days=1))
    ContaPagar.objects.filter(origem=6, origem_id=pid).update(vencimento=timezone.localdate() - timedelta(days=1))
    ficha = api.get(f"/api/pedidos-compra/{pid}").data
    assert (ficha["recebimento_status"], ficha["pagamento_status"]) == ("Atrasado", "Atrasado")
    linha = next(x for x in api.get("/api/pedidos-compra").data["results"] if x["id"] == pid)
    # Na lista da MarketUP o pagamento não mostra "atrasado".
    assert (linha["recebimento_lista"], linha["pagamento_lista"]) == ("Atrasado", "Pendente")
    copia = api.post(f"/api/pedidos-compra/{pid}/copiar").data
    assert copia["status"] == 1 and copia["parcelas"] == [] and all(i["recebido"] == "0.000" for i in copia["itens"])
