from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.financeiro.models import ContaCorrente, ContaGerencial, ContaPagar, ContaReceber, LancamentoCaixa, TipoPagamento
from apps.usuarios.models import Grupo, Usuario

pytestmark = pytest.mark.django_db


def hoje():
    return timezone.localdate()


def d(dias=0):
    return (hoje() + timedelta(days=dias)).isoformat()


@pytest.fixture
def fin():
    api = APIClient()
    api.force_authenticate(Usuario.objects.create_user("contador", password="x", grupo=Grupo.objects.get(nome="Administrador")))
    g = lambda pk, nome, tipo, dre: ContaGerencial.objects.create(id=pk, nome=nome, tipo=tipo, classificacao_dre=dre)  # noqa: E731
    return {
        "api": api,
        "receitas": g(4, "Outras Receitas", "E", ""),
        "vendas": g(52, "Vendas via Pedido", "E", "entradas"),
        "aluguel": g(13, "Aluguel", "S", "aluguel"),
        "manut": g(7, "Manutenção", "S", "gerais_administrativas"),
        "tr_saida": g(35, "Transferência", "S", "gerais_administrativas"),
        "tr_entrada": g(54, "Transferência", "E", "entradas"),
        "caixa": ContaCorrente.objects.create(id=1, nome="Caixa", interna=True),
        "nubank": ContaCorrente.objects.create(id=4, nome="Nubank CNPJ"),
        "pix": TipoPagamento.objects.create(descricao="PIX"),
    }


def baixa(conta, valor, **extra):
    return {"data": hoje().isoformat(), "conta_corrente": conta.id, "valor": valor, **extra}


def test_conta_manual_repete_e_recebe_com_juros(fin):
    api = fin["api"]
    r = api.post("/api/contas-receber", {
        "descricao": "Aluguel da sala", "conta_gerencial": fin["receitas"].id, "emissao": d(), "vencimento": d(), "valor": "500", "repetir": 2,
    }, format="json")
    assert r.status_code == 201, r.data
    contas = list(ContaReceber.objects.order_by("vencimento"))
    assert [(c.parcela, c.parcelas, c.origem, c.manual) for c in contas] == [(1, 3, 3, True), (2, 3, 3, True), (3, 3, 3, True)]
    assert contas[1].vencimento.month == (hoje().month % 12) + 1
    # Recebimento parcial: status com "parcial" e o movimento no caixa, com a descrição da MarketUP.
    p = api.patch(f"/api/contas-receber/{r.data['id']}", {"novas_baixas": [baixa(fin["caixa"], "200")]}, format="json")
    assert p.status_code == 200 and p.data["saldo"] == "300.00" and p.data["situacao"] == "hoje_parcial"
    mov = LancamentoCaixa.objects.get(conta_receber_id=r.data["id"])
    assert mov.descricao == "ALUGUEL DA SALA - OUTRAS RECEITAS" and mov.manual and mov.conta_gerencial_id == 4
    # Mais que o saldo: recusado; a diferença vira juros (a tela pergunta) e quita.
    assert api.patch(f"/api/contas-receber/{r.data['id']}", {"novas_baixas": [baixa(fin["caixa"], "310")]}, format="json").status_code == 400
    ok = api.patch(f"/api/contas-receber/{r.data['id']}", {"novas_baixas": [baixa(fin["caixa"], "310", juros="10")]}, format="json")
    assert ok.data["saldo"] == "0.00" and ok.data["situacao"] == "quitada" and len(ok.data["baixas"]) == 2
    # Com baixa: valor e vencimento travam.
    assert api.patch(f"/api/contas-receber/{r.data['id']}", {"valor": "600"}, format="json").status_code == 400
    # Valores inválidos.
    outra = contas[1].id
    invalido = api.patch(f"/api/contas-receber/{outra}", {"novas_baixas": [baixa(fin["caixa"], "0")]}, format="json")
    assert invalido.status_code == 400 and "inválido" in str(invalido.data)


def test_lista_filtros_e_totais(fin):
    api = fin["api"]
    for venc, valor in ((-5, "100"), (0, "200"), (10, "300")):
        api.post("/api/contas-receber", {"descricao": f"Conta {valor}", "conta_gerencial": fin["receitas"].id, "emissao": d(-10), "vencimento": d(venc), "valor": valor}, format="json")
    tudo = api.get("/api/contas-receber").data
    assert tudo["count"] == 3 and tudo["total_valor"] == "600.00" and tudo["total_saldo"] == "600.00"
    assert [x["situacao"] for x in tudo["results"]] == ["vencida", "hoje", "a_vencer"]
    assert api.get("/api/contas-receber?vencidas=1").data["count"] == 1
    assert api.get("/api/contas-receber?vencidas=0").data["count"] == 2
    primeira = tudo["results"][0]["id"]
    api.patch(f"/api/contas-receber/{primeira}", {"novas_baixas": [baixa(fin["caixa"], "100")]}, format="json")
    assert api.get("/api/contas-receber?quitadas=1").data["count"] == 1
    assert api.get("/api/contas-receber?quitadas=0").data["total_saldo"] == "500.00"
    assert api.get(f"/api/contas-receber?vencimento_de={d(1)}").data["count"] == 1
    assert api.get("/api/contas-receber?search=conta 300").data["count"] == 1


def test_receber_varias_de_uma_vez(fin):
    api = fin["api"]
    ids = [api.post("/api/contas-receber", {"descricao": f"C{v}", "conta_gerencial": fin["receitas"].id, "emissao": d(), "vencimento": d(), "valor": v}, format="json").data["id"] for v in ("10", "20")]
    r = api.post("/api/contas-receber/baixar-varias", {"contas": ids, "data": d(), "conta_corrente": fin["nubank"].id, "tipo_pagamento": fin["pix"].id}, format="json")
    assert r.status_code == 200 and r.data["baixadas"] == 2
    assert not ContaReceber.objects.filter(saldo__gt=0).exists()
    assert LancamentoCaixa.objects.filter(conta_corrente=fin["nubank"]).count() == 2


def test_conta_a_pagar_paga_e_remove_pagamento(fin):
    api = fin["api"]
    c = api.post("/api/contas-pagar", {"descricao": "Troca pneu do carro", "conta_gerencial": fin["manut"].id, "beneficiario_nome": "Borracharia", "emissao": d(), "vencimento": d(), "valor": "259.80"}, format="json")
    assert c.status_code == 201, c.data
    assert c.data["origem"] == 2 and c.data["pessoa_nome"] == "Borracharia"
    pago = api.patch(f"/api/contas-pagar/{c.data['id']}", {"novas_baixas": [baixa(fin["nubank"], "259.80")]}, format="json")
    assert pago.data["situacao"] == "quitada"
    mov = LancamentoCaixa.objects.get(conta_pagar_id=c.data["id"])
    assert mov.credito is False and mov.valor == Decimal("259.80")
    # X + Salvar: o pagamento sai e o movimento some.
    volta = api.patch(f"/api/contas-pagar/{c.data['id']}", {"manter_baixas": []}, format="json")
    assert volta.data["saldo"] == "259.80" and not LancamentoCaixa.objects.filter(conta_pagar_id=c.data["id"]).exists()
    # Manual se exclui; vindo de documento (comissão), não.
    assert api.delete(f"/api/contas-pagar/{c.data['id']}").status_code == 204
    doc = ContaPagar.objects.create(origem=5, origem_id=1, descricao="Comissão", emissao=hoje(), vencimento=hoje(), valor=10, saldo=10)
    assert api.delete(f"/api/contas-pagar/{doc.id}").status_code == 400
    # Descrição de conta vinda de documento não muda pela ficha.
    assert api.patch(f"/api/contas-pagar/{doc.id}", {"descricao": "Outra"}, format="json").status_code == 400


def test_movimentacao_lancamento_avulso_e_transferencia(fin):
    api = fin["api"]
    entrada = api.post("/api/movimentacao-caixa", {"credito": True, "conta_gerencial": fin["receitas"].id, "data": d(), "conta_corrente": fin["caixa"].id, "valor": "1000", "descricao": "Aporte"}, format="json")
    assert entrada.status_code == 201, entrada.data
    # Lançamento avulso = título já quitado (origem Receitas, manual) + a baixa.
    titulo = ContaReceber.objects.get()
    assert titulo.saldo == 0 and titulo.origem == 3 and titulo.manual
    api.post("/api/movimentacao-caixa", {"credito": False, "conta_gerencial": fin["aluguel"].id, "data": d(), "conta_corrente": fin["caixa"].id, "valor": "300", "descricao": "Aluguel"}, format="json")
    t = api.post("/api/transferencias", {"data": d(), "conta_origem": fin["caixa"].id, "conta_destino": fin["nubank"].id, "valor": "200", "documento": "123"}, format="json")
    assert t.status_code == 201, t.data
    lista = api.get(f"/api/movimentacao-caixa?de={d()}&ate={d()}").data
    assert [m["valor"] for m in lista["results"]] == ["1000.00", "-300.00", "-200.00", "200.00"]
    assert lista["saldo_periodo"] == "700.00" and lista["saldo_atual"] == "700.00"
    so_caixa = api.get(f"/api/movimentacao-caixa?de={d()}&ate={d()}&conta_corrente={fin['caixa'].id}").data
    assert so_caixa["saldo_atual"] == "500.00"
    assert api.get(f"/api/movimentacao-caixa?de={d()}&ate={d()}&tipo=-1").data["saldo_periodo"] == "-500.00"
    # Mesma conta de origem e destino: recusado.
    assert api.post("/api/transferencias", {"data": d(), "conta_origem": 1, "conta_destino": 1, "valor": "5"}, format="json").status_code == 400
    # Excluir movimento manual: o avulso leva o título junto; a transferência sai inteira.
    mov_entrada = lista["results"][0]["id"]
    assert api.delete(f"/api/movimentacao-caixa?id={mov_entrada}").status_code == 204
    assert not ContaReceber.objects.exists()
    mov_transf = lista["results"][2]["id"]
    api.delete(f"/api/movimentacao-caixa?id={mov_transf}")
    assert not LancamentoCaixa.objects.filter(transferencia__isnull=False).exists()


def test_fluxo_de_caixa_realizado_previsto_e_vencidos(fin):
    api = fin["api"]
    api.post("/api/movimentacao-caixa", {"credito": True, "conta_gerencial": fin["vendas"].id, "data": d(), "conta_corrente": fin["caixa"].id, "valor": "1000", "descricao": "Venda"}, format="json")
    api.post("/api/contas-pagar", {"descricao": "Vencida", "conta_gerencial": fin["aluguel"].id, "emissao": d(-30), "vencimento": d(-3), "valor": "300"}, format="json")
    api.post("/api/contas-receber", {"descricao": "Atrasado", "conta_gerencial": fin["receitas"].id, "emissao": d(-30), "vencimento": d(-2), "valor": "100"}, format="json")
    api.post("/api/contas-pagar", {"descricao": "Próxima", "conta_gerencial": fin["manut"].id, "emissao": d(), "vencimento": d(5), "valor": "50"}, format="json")
    api.post("/api/contas-receber", {"descricao": "Futura", "conta_gerencial": fin["receitas"].id, "emissao": d(), "vencimento": d(20), "valor": "400"}, format="json")
    # Hoje: só o realizado.
    f = api.get(f"/api/fluxo-caixa?de={d()}&ate={d()}&visao=dias").data
    assert f["saldo_inicial"] == ["0.00"] and f["saldo_final"] == ["1000.00"]
    assert f["receita"]["grupos"][0]["nome"] == "Operacionais" and f["receita"]["grupos"][0]["contas"][0]["nome"] == "Vendas via Pedido"
    # Período no futuro (regra conferida na MarketUP): saldo hoje − a pagar vencido + a receber vencido + previsto até a véspera.
    futuro = api.get(f"/api/fluxo-caixa?de={d(10)}&ate={d(25)}&visao=dias").data
    assert futuro["saldo_inicial"][0] == "750.00"  # 1000 − 300 + 100 − 50
    assert futuro["saldo_final"][-1] == "1150.00"  # + 400 previsto
    assert all(c["previsto"] for c in futuro["colunas"])
    # Cards.
    assert f["inadimplencia"]["total"] == "100.00" and f["inadimplencia"]["quantidade"] == 1
    assert f["endividamento"]["total"] == "300.00"
    # Transferência não mexe no consolidado.
    api.post("/api/transferencias", {"data": d(), "conta_origem": 1, "conta_destino": 4, "valor": "200"}, format="json")
    assert api.get(f"/api/fluxo-caixa?de={d()}&ate={d()}&visao=dias").data["saldo_final"] == ["1000.00"]
    assert api.get(f"/api/fluxo-caixa?de={d()}&ate={d()}&visao=dias&conta_corrente=1").data["saldo_final"] == ["800.00"]
    # Visão por meses.
    meses = api.get(f"/api/fluxo-caixa?de={d()}&ate={d(70)}&visao=meses").data
    assert len(meses["colunas"]) >= 3
