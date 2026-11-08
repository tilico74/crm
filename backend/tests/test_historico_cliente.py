from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Unidade
from apps.clientes.models import Cliente, EnderecoCliente, HistoricoCliente
from apps.financeiro.models import CondicaoPagamento, TipoPagamento
from apps.usuarios.models import Grupo, Usuario
from apps.vendas.models import Orcamento, Pedido

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    cliente_api = APIClient()
    cliente_api.force_authenticate(Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador")))
    return cliente_api


def test_historico_junta_orcamentos_e_pedidos_com_status_atual(api):
    cliente = Cliente.objects.create(nome="Gabriel Teste", limite_credito=Decimal("5000"))
    outro = Cliente.objects.create(nome="Outro")
    endereco = EnderecoCliente.objects.create(cliente=cliente, logradouro="Rua A")
    produto = Produto.objects.create(descricao="Rede", unidade=Unidade.objects.get(pk=1), preco_venda=Decimal("10"))
    pix = TipoPagamento.objects.create(descricao="PIX")
    condicao = CondicaoPagamento.objects.create(tipo=pix, descricao="À vista", parcelas=1)
    HistoricoCliente.objects.create(cliente=cliente, data=date(2026, 1, 1), descricao="Ligou pedindo visita")

    o1 = Orcamento.objects.create(id=826, cliente=cliente, emissao=date(2018, 7, 10))
    Orcamento.objects.create(cliente=outro, emissao=date(2026, 1, 1))  # de outro cliente: não aparece
    # Orçamento → pedido → concluído e pago: o orçamento aparece CONCLUÍDO e o pedido FATURADO até entregar.
    o2 = api.post("/api/orcamentos", {"cliente": cliente.id, "emissao": "2026-02-02",
                                       "itens": [{"produto": produto.id, "quantidade": "2", "valor_unitario": "10"}]}, format="json").data
    copia = api.get(f"/api/pedidos/novo?orcamento={o2['id']}").data
    parcelas = api.get(f"/api/pedidos/gerar-parcelas?condicao={condicao.id}&valor=20").data
    pedido = api.post("/api/pedidos", {**copia, "endereco_faturamento": endereco.id, "endereco_entrega": endereco.id, "parcelas": parcelas}, format="json").data
    api.post(f"/api/pedidos/{pedido['id']}/concluir")
    Pedido.objects.filter(pk=pedido["id"]).update(emissao=date(2026, 10, 27))

    h = api.get(f"/api/clientes/{cliente.id}/historico").data
    assert h["count"] == 3
    assert [(x["descricao"], x["status"], x["origem"]) for x in h["results"]] == [
        (f"PEDIDO Nº{pedido['id']:06d}", "FATURADO", "pedido"),
        (f"ORÇAMENTO Nº{o2['id']:06d}", "CONCLUÍDO", "orcamento"),
        ("ORÇAMENTO Nº000826", "NOVO", "orcamento"),
    ]
    assert h["results"][2]["chave"] == o1.id and h["results"][0]["origem_id"] == 8 and h["results"][2]["origem_id"] == -8
    # O status acompanha o documento: entregue e pago vira CONCLUÍDO.
    conta = api.get(f"/api/pedidos/{pedido['id']}").data["parcelas"][0]["conta_receber"]
    api.post(f"/api/contas-receber/{conta}/receber", {"data": "2026-11-08", "valor": "20"}, format="json")
    api.post(f"/api/pedidos/{pedido['id']}/entregar", {}, format="json")
    assert api.get(f"/api/clientes/{cliente.id}/historico").data["results"][0]["status"] == "CONCLUÍDO"
    # As anotações continuam na ficha, não nessa lista.
    assert [x["descricao"] for x in api.get(f"/api/clientes/{cliente.id}").data["historico"]] == ["Ligou pedindo visita"]


def test_historico_pagina_de_5_em_5(api):
    cliente = Cliente.objects.create(nome="Ana")
    for n in range(7):
        Orcamento.objects.create(cliente=cliente, emissao=date(2026, 1, n + 1))
    p1 = api.get(f"/api/clientes/{cliente.id}/historico").data
    p2 = api.get(f"/api/clientes/{cliente.id}/historico?page=2").data
    assert p1["count"] == 7 and len(p1["results"]) == 5 and len(p2["results"]) == 2
    assert p1["results"][0]["data"] == date(2026, 1, 7) and p2["results"][-1]["data"] == date(2026, 1, 1)
