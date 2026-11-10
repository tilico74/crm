from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Unidade
from apps.estoque.models import LocalEstoque, Movimentacao, Saldo
from apps.usuarios.models import Grupo, Usuario

pytestmark = pytest.mark.django_db


@pytest.fixture
def est():
    api = APIClient()
    api.force_authenticate(Usuario.objects.create_user("estoquista", password="x", grupo=Grupo.objects.get(nome="Administrador")))
    un = Unidade.objects.get(pk=1)
    return {
        "api": api,
        "padrao": LocalEstoque.objects.get(pk=1),
        "deposito": LocalEstoque.objects.create(nome="Depósito", tipo_id=1),
        "rede": Produto.objects.create(descricao="Rede 5x5", unidade=un, preco_venda=Decimal("100"), preco_custo=Decimal("40"), movimenta_estoque=True, estoque_minimo=Decimal("5")),
        "servico_like": Produto.objects.create(descricao="Sem estoque", unidade=un, preco_venda=Decimal("10")),
    }


def saldo(produto, local):
    return Saldo.objects.filter(produto=produto, local=local).values_list("quantidade", flat=True).first() or Decimal(0)


def mov(api, tipo, itens, **extra):
    return api.post("/api/movimentacoes-estoque", {"tipo": tipo, "data": timezone.localdate().isoformat(), "itens": itens, **extra}, format="json")


def test_dados_iniciais_da_marketup():
    assert LocalEstoque.objects.get(pk=1).nome == "Estoque Padrão" and LocalEstoque.objects.get(pk=1).padrao
    from apps.estoque.models import TipoEstocagem

    assert list(TipoEstocagem.objects.order_by("id").values_list("id", "nome")) == [(1, "Padrão"), (2, "Refrigerado")]


def test_entrada_saida_transferencia_e_regras(est):
    api, rede = est["api"], est["rede"]
    e = mov(api, 1, [{"produto": rede.id, "quantidade": "20", "valor_unitario": "40"}], local_destino=1, pessoa="Fornecedor X")
    assert e.status_code == 201, e.data
    assert saldo(rede, est["padrao"]) == 20 and e.data["total_valor"] == "800.00"
    s = mov(api, 2, [{"produto": rede.id, "quantidade": "3"}], local_origem=1, perda_avaria=True)
    assert s.status_code == 201 and saldo(rede, est["padrao"]) == 17 and s.data["perda_avaria"] is True
    t = mov(api, 3, [{"produto": rede.id, "quantidade": "7"}], local_origem=1, local_destino=est["deposito"].id)
    assert t.status_code == 201 and saldo(rede, est["padrao"]) == 10 and saldo(rede, est["deposito"]) == 7
    # Regras da MarketUP.
    assert "origem não pode ser igual" in str(mov(api, 3, [{"produto": rede.id, "quantidade": "1"}], local_origem=1, local_destino=1).data)
    assert mov(api, 1, [], local_destino=1).status_code == 400
    assert mov(api, 1, [{"produto": est["servico_like"].id, "quantidade": "1"}], local_destino=1).status_code == 400  # não movimenta estoque
    assert mov(api, 4, [{"produto": rede.id, "quantidade": "1"}], local_destino=1).status_code == 400  # acerto só automático
    # Entrada não guarda motivo nem perda e avaria.
    assert mov(api, 1, [{"produto": rede.id, "quantidade": "1"}], local_destino=1, perda_avaria=True).data["perda_avaria"] is False


def test_consulta_e_ajuste(est):
    api, rede = est["api"], est["rede"]
    mov(api, 1, [{"produto": rede.id, "quantidade": "4"}], local_destino=1)
    c = api.get("/api/consulta-estoque").data
    linha = next(x for x in c["results"] if x["produto"] == rede.id)
    assert linha["quantidade"] == "4.000" and linha["abaixo_minimo"] and linha["valor_total"] == "160.00"
    assert all(x["produto"] != est["servico_like"].id for x in c["results"])
    assert api.get("/api/consulta-estoque?abaixo_minimo=1").data["count"] == 1
    a = api.patch("/api/consulta-estoque", {"produto": rede.id, "local": 1, "quantidade": "9"}, format="json")
    assert a.status_code == 200 and a.data["quantidade"] == "9.000"
    acerto = Movimentacao.objects.get(tipo=Movimentacao.Tipo.ACERTO, origem=Movimentacao.Origem.AJUSTE)
    assert acerto.itens.get().quantidade == Decimal("5")
    assert acerto.total_valor == Decimal("200.00")  # valorizado pelo custo (5 x 40)


def test_inventario_bloqueia_e_fecha_com_acerto(est):
    api, rede = est["api"], est["rede"]
    mov(api, 1, [{"produto": rede.id, "quantidade": "10"}], local_destino=1)
    inv = api.post("/api/locais-estoque/1/inventarios").data[0]
    assert inv["status"] == 1
    assert api.get("/api/locais-estoque/1").data["em_inventario"] == inv["id"]
    bloqueada = mov(api, 2, [{"produto": rede.id, "quantidade": "1"}], local_origem=1)
    assert bloqueada.status_code == 400 and "inventário" in str(bloqueada.data)
    assert api.post("/api/locais-estoque/1/inventarios").status_code == 400  # já em andamento
    detalhe = api.get(f"/api/inventarios/{inv['id']}").data
    assert detalhe["itens"][0]["saldo"] == "10.000"
    fim = api.post(f"/api/inventarios/{inv['id']}", {"acao": "concluir", "contagens": {str(rede.id): "8"}}, format="json")
    assert fim.status_code == 200 and fim.data["status"] == 2 and fim.data["movimentacao"]
    assert saldo(rede, est["padrao"]) == 8
    assert Movimentacao.objects.get(pk=fim.data["movimentacao"]).total_valor == Decimal("-80.00")  # -2 x custo 40
    assert mov(api, 2, [{"produto": rede.id, "quantidade": "1"}], local_origem=1).status_code == 201  # desbloqueou
    # Concluído: mostra a fotografia da contagem (saldo 10, contado 8), não o saldo de agora (7).
    item = api.get(f"/api/inventarios/{inv['id']}").data["itens"][0]
    assert (item["saldo"], item["contado"]) == ("10.000", "8.000")
    # Cancelar outro inventário.
    outro = api.post("/api/locais-estoque/1/inventarios").data[0]
    assert api.post(f"/api/inventarios/{outro['id']}", {"acao": "cancelar"}, format="json").data["status"] == 3


def test_local_padrao_unico_e_exclusao(est):
    api = est["api"]
    novo = api.post("/api/locais-estoque", {"nome": "Loja", "tipo": 1, "ativo": True, "padrao": True}, format="json")
    assert novo.status_code == 201
    assert not LocalEstoque.objects.get(pk=1).padrao
    assert api.delete("/api/locais-estoque/1").status_code == 400  # do sistema
    assert api.delete(f"/api/locais-estoque/{novo.data['id']}").status_code == 204
    assert api.delete("/api/tipos-estocagem/1").status_code == 400


def test_pedido_de_venda_baixa_e_devolve_estoque(est):
    from apps.clientes.models import Cliente, EnderecoCliente
    from apps.financeiro.models import CondicaoPagamento, TipoPagamento

    api, rede = est["api"], est["rede"]
    mov(api, 1, [{"produto": rede.id, "quantidade": "10"}], local_destino=1)
    cliente = Cliente.objects.create(nome="Ana", limite_credito=Decimal("99999"))
    end = EnderecoCliente.objects.create(cliente=cliente, logradouro="Rua A")
    cond = CondicaoPagamento.objects.create(tipo=TipoPagamento.objects.create(descricao="PIX"), descricao="À vista", parcelas=1)
    parcelas = api.get(f"/api/pedidos/gerar-parcelas?condicao={cond.id}&valor=310").data
    p = api.post("/api/pedidos", {
        "cliente": cliente.id, "endereco_faturamento": end.id, "endereco_entrega": end.id, "emissao": timezone.localdate().isoformat(),
        "itens": [{"produto": rede.id, "quantidade": "3", "valor_unitario": "100"}, {"produto": est["servico_like"].id, "quantidade": "1", "valor_unitario": "10"}],
        "parcelas": parcelas,
    }, format="json").data
    api.post(f"/api/pedidos/{p['id']}/concluir")
    assert api.post(f"/api/pedidos/{p['id']}/entregar", {}, format="json").status_code == 200
    assert saldo(rede, est["padrao"]) == 7
    saida = Movimentacao.objects.get(origem=Movimentacao.Origem.PEDIDO_VENDA, origem_id=p["id"])
    assert saida.tipo == Movimentacao.Tipo.SAIDA and saida.itens.count() == 1 and not saida.manual
    assert saida.total_valor == Decimal("120.00")  # pelo custo (3 x 40), como a movimentação manual da MarketUP
    # Cancelar devolve o entregue (para o depósito, se escolhido).
    api.post(f"/api/pedidos/{p['id']}/cancelar", {"local": est["deposito"].id}, format="json")
    assert saldo(rede, est["deposito"]) == 3
    assert Movimentacao.objects.filter(origem=Movimentacao.Origem.CANCELAMENTO_VENDA, origem_id=p["id"]).exists()


def test_bloquear_venda_com_estoque_negativo(est):
    from apps.vendas.models import ParametrosVenda
    from apps.estoque.regras import saida_do_pedido

    ParametrosVenda.objects.update_or_create(pk=1, defaults={"bloquear_venda_estoque_negativo": True})

    class Item:
        produto = est["rede"]
        produto_id = est["rede"].id
        descricao = "Rede 5x5"
        unidade = est["rede"].unidade
        valor_unitario = Decimal("100")

    class Ped:
        id = 1
        cliente_id = None

    with pytest.raises(Exception) as erro:
        saida_do_pedido(Ped(), [(Item(), Decimal("1"))])
    assert "Estoque insuficiente" in str(erro.value)
