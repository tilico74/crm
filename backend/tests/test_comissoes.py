from datetime import date
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Unidade
from apps.clientes.models import Cliente, EnderecoCliente
from apps.comissoes.models import Comissao
from apps.financeiro.models import CondicaoPagamento, ContaCorrente, ContaPagar, TipoPagamento
from apps.usuarios.models import Funcionario, Grupo, Usuario

pytestmark = pytest.mark.django_db


@pytest.fixture
def cenario():
    gerente = Usuario.objects.create_user("gerente", password="x", grupo=Grupo.objects.get(nome="Administrador"))
    api = APIClient()
    api.force_authenticate(gerente)
    esther = Funcionario.objects.create(nome="Esther", vendedor=True, comissao=Decimal("5"))
    nelson = Funcionario.objects.create(nome="Nelson", vendedor=True, comissao=Decimal("3"))
    cliente = Cliente.objects.create(nome="Cliente Teste", limite_credito=Decimal("100000"))
    endereco = EnderecoCliente.objects.create(cliente=cliente, logradouro="Rua A")
    produto = Produto.objects.create(descricao="Rede", unidade=Unidade.objects.get(pk=1), preco_venda=Decimal("100"))
    pix = TipoPagamento.objects.create(descricao="PIX")
    condicao = CondicaoPagamento.objects.create(tipo=pix, descricao="À vista", parcelas=1)
    caixa = ContaCorrente.objects.create(nome="Caixa", interna=True)
    return {"api": api, "gerente": gerente, "esther": esther, "nelson": nelson, "cliente": cliente, "endereco": endereco,
            "produto": produto, "condicao": condicao, "caixa": caixa}


def pedido_concluido(c, vendedor, desconto="0", frete="0"):
    """Pedido de 4 × R$ 100 com desconto e frete, concluído."""
    api = c["api"]
    dados = {
        "cliente": c["cliente"].id, "endereco_faturamento": c["endereco"].id, "endereco_entrega": c["endereco"].id,
        "vendedor": vendedor.id, "emissao": timezone.localdate().isoformat(), "desconto": desconto, "frete": frete,
        "itens": [{"produto": c["produto"].id, "quantidade": "4", "valor_unitario": "100"}],
    }
    total = Decimal("400") - Decimal(desconto) + Decimal(frete)
    dados["parcelas"] = api.get(f"/api/pedidos/gerar-parcelas?condicao={c['condicao'].id}&valor={total}").data
    pedido = api.post("/api/pedidos", dados, format="json")
    assert pedido.status_code == 201, pedido.data
    assert api.post(f"/api/pedidos/{pedido.data['id']}/concluir").status_code == 200
    return pedido.data


def test_concluir_pedido_gera_comissao_sem_frete(cenario):
    p = pedido_concluido(cenario, cenario["esther"], desconto="50", frete="30")
    comissao = Comissao.objects.get(pedido_id=p["id"])
    # Base = total (400 − 50 + 30 = 380) menos o frete (30) = 350; 5% = 17,50.
    assert comissao.tipo == Comissao.Tipo.AUTOMATICO and comissao.vendedor == cenario["esther"]
    assert (comissao.valor_venda, comissao.percentual, comissao.valor) == (Decimal("350.00"), Decimal("5.00"), Decimal("17.50"))
    lista = cenario["api"].get("/api/comissoes?fechada=false").data
    assert lista["count"] == 1 and lista["results"][0]["vendedor_nome"] == "Esther" and lista["results"][0]["tipo_nome"] == "Automático"


def test_pedido_sem_vendedor_nao_gera(cenario):
    api = cenario["api"]
    p = pedido_concluido(cenario, cenario["esther"])
    Comissao.objects.all().delete()
    from apps.vendas.models import Pedido

    Pedido.objects.filter(pk=p["id"]).update(vendedor=None)
    from apps.comissoes.regras import gerar_do_pedido

    assert gerar_do_pedido(Pedido.objects.get(pk=p["id"])) is None
    assert api.get("/api/comissoes").data["count"] == 0


def test_lancamento_manual_calcula_e_valida(cenario):
    api = cenario["api"]
    p = pedido_concluido(cenario, cenario["nelson"])
    busca = api.get(f"/api/comissoes/pedidos?search={p['id']}").data
    assert busca[0]["valor"] == "400.00" and busca[0]["percentual"] == "3.00"
    pelo_pct = api.post("/api/comissoes", {"vendedor": cenario["esther"].id, "pedido": p["id"], "emissao": "2026-11-09", "valor_venda": "400", "percentual": "2.5"}, format="json")
    assert pelo_pct.status_code == 201, pelo_pct.data
    assert pelo_pct.data["valor"] == "10.00" and pelo_pct.data["tipo"] == Comissao.Tipo.MANUAL
    pelo_valor = api.post("/api/comissoes", {"vendedor": cenario["esther"].id, "emissao": "2026-11-09", "valor_venda": "400", "valor": "20"}, format="json")
    assert pelo_valor.data["percentual"] == "5.00"
    demais = api.post("/api/comissoes", {"vendedor": cenario["esther"].id, "emissao": "2026-11-09", "valor_venda": "400", "valor": "500"}, format="json")
    assert demais.status_code == 400 and "superior ao valor da venda" in str(demais.data)
    zero = api.post("/api/comissoes", {"vendedor": cenario["esther"].id, "emissao": "2026-11-09", "valor_venda": "400", "percentual": "-1"}, format="json")
    assert zero.data["valor"] == "0.00"
    # Comissionado não muda depois de lançado.
    assert api.patch(f"/api/comissoes/{pelo_pct.data['id']}", {"vendedor": cenario["nelson"].id}, format="json").status_code == 400


def test_fechamento_gera_contas_a_pagar_e_trava(cenario):
    api = cenario["api"]
    pedido_concluido(cenario, cenario["esther"])  # 400 × 5% = 20
    pedido_concluido(cenario, cenario["nelson"])  # 400 × 3% = 12
    pedido_concluido(cenario, cenario["esther"])  # + 20
    ids = list(Comissao.objects.values_list("id", flat=True))
    f = api.post("/api/fechamentos-comissao", {"data": "2026-11-30", "descricao": "Novembro", "comissoes": ids}, format="json")
    assert f.status_code == 201, f.data
    assert f.data["valor_total"] == "52.00" and len(f.data["comissoes"]) == 3
    contas = {c["funcionario__nome"]: c["valor"] for c in f.data["contas_pagar"]}
    assert contas == {"Esther": Decimal("40.00"), "Nelson": Decimal("12.00")}
    # Fechado não altera, não exclui e não fecha de novo.
    um = ids[0]
    assert api.patch(f"/api/comissoes/{um}", {"observacao": "x"}, format="json").status_code == 400
    assert api.delete(f"/api/comissoes/{um}").status_code == 400
    assert api.post("/api/fechamentos-comissao", {"data": "2026-11-30", "comissoes": [um]}, format="json").status_code == 400
    # Desfazer: volta tudo a ficar em aberto e as contas a pagar são canceladas.
    assert api.delete(f"/api/fechamentos-comissao/{f.data['id']}").status_code == 204
    assert Comissao.objects.filter(fechamento__isnull=True).count() == 3
    assert not ContaPagar.objects.filter(cancelada=False).exists()


def test_gerente_aprova_e_vendedor_nao_aprova_a_propria(cenario):
    api = cenario["api"]
    pedido_concluido(cenario, cenario["esther"])
    ids = list(Comissao.objects.values_list("id", flat=True))
    cenario["esther"].usuario = cenario["gerente"]
    cenario["esther"].save()
    propria = api.post("/api/fechamentos-comissao", {"data": "2026-11-30", "comissoes": ids}, format="json")
    assert propria.status_code == 400 and "própria comissão" in str(propria.data)
    # Sem a permissão "Aprovação de comissões", não fecha.
    vendedor = APIClient()
    vendedor.force_authenticate(Usuario.objects.create_user("vend", password="x", grupo=Grupo.objects.create(nome="Só lançamento")))
    assert vendedor.post("/api/fechamentos-comissao", {"data": "2026-11-30", "comissoes": ids}, format="json").status_code == 403


def test_cancelar_pedido_apaga_ou_estorna(cenario):
    api = cenario["api"]
    aberto = pedido_concluido(cenario, cenario["esther"])
    fechado = pedido_concluido(cenario, cenario["nelson"])
    comissao_fechada = Comissao.objects.get(pedido_id=fechado["id"])
    api.post("/api/fechamentos-comissao", {"data": "2026-11-30", "comissoes": [comissao_fechada.id]}, format="json")
    # Os pedidos não têm recebimento: cancelam direto.
    api.post(f"/api/pedidos/{aberto['id']}/cancelar", {}, format="json")
    api.post(f"/api/pedidos/{fechado['id']}/cancelar", {}, format="json")
    assert not Comissao.objects.filter(pedido_id=aberto["id"]).exists()
    estorno = Comissao.objects.get(estorno_de=comissao_fechada)
    assert estorno.valor == Decimal("-12.00") and estorno.fechamento_id is None and "cancelado" in estorno.observacao
    # O estorno entra no próximo fechamento e desconta.
    pedido_concluido(cenario, cenario["nelson"])
    abertas = list(Comissao.objects.filter(fechamento__isnull=True).values_list("id", flat=True))
    f = api.post("/api/fechamentos-comissao", {"data": "2026-12-31", "comissoes": abertas}, format="json").data
    assert f["valor_total"] == "0.00" and f["contas_pagar"] == []  # 12 − 12: nada a pagar
    # Cancelar de novo não estorna duas vezes.
    from apps.comissoes.regras import estornar_do_pedido
    from apps.vendas.models import Pedido

    estornar_do_pedido(Pedido.objects.get(pk=fechado["id"]))
    assert Comissao.objects.filter(estorno_de=comissao_fechada).count() == 1


def test_filtros(cenario):
    api = cenario["api"]
    pedido_concluido(cenario, cenario["esther"])
    pedido_concluido(cenario, cenario["nelson"])
    assert api.get(f"/api/comissoes?vendedor={cenario['nelson'].id}").data["count"] == 1
    assert api.get(f"/api/comissoes?emissao_de={date(2099, 1, 1).isoformat()}").data["count"] == 0
    assert api.get("/api/comissoes?search=nelson").data["count"] == 1
