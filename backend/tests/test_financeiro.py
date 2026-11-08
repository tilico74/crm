import pytest
from rest_framework.test import APIClient

from apps.financeiro.models import Banco, CondicaoPagamento, ContaCorrente, ContaGerencial, TipoPagamento
from apps.usuarios.models import Funcionalidade, Grupo, PermissaoGrupo, Usuario

pytestmark = pytest.mark.django_db


def cliente_logado(usuario):
    api = APIClient()
    api.force_authenticate(usuario)
    return api


@pytest.fixture
def vendedor():
    return Usuario.objects.create_user("vendedor", password="x", grupo=Grupo.objects.get(nome="Vendedor"))


@pytest.fixture
def admin():
    return Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))


def _liberar(usuario, codigo, **acoes):
    PermissaoGrupo.objects.create(grupo=usuario.grupo, funcionalidade=Funcionalidade.objects.get(codigo=codigo), **acoes)


@pytest.mark.parametrize(
    "rota,codigo",
    [
        ("/api/contas-gerenciais", "contas_gerenciais"),
        ("/api/contas-correntes", "contas_correntes"),
        ("/api/bancos", "contas_correntes"),
        ("/api/tipos-pagamento", "tipos_pagamento"),
    ],
)
def test_permissao_por_funcionalidade(vendedor, rota, codigo):
    api = cliente_logado(vendedor)
    assert api.get(rota).status_code == 403
    _liberar(vendedor, codigo, acessar=True)
    assert api.get(rota).status_code == 200
    assert api.post(rota, {}, format="json").status_code in (403, 405)


def test_sem_login_nao_acessa():
    assert APIClient().get("/api/contas-gerenciais").status_code == 401


def test_cria_conta_gerencial_com_auditoria(admin):
    api = cliente_logado(admin)
    pai = ContaGerencial.objects.create(id=10, tipo="S", nome="Saídas", sistema=True)
    resposta = api.post(
        "/api/contas-gerenciais",
        {"tipo": "S", "conta_origem": pai.pk, "posicao_relativa": 3, "codigo_referencia": "1.3",
         "classificacao_dre": "utilidades", "nome": "Água", "compras": False, "ativo": True, "sistema": True},
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    conta = ContaGerencial.objects.get(pk=resposta.data["id"])
    assert conta.criado_por == admin and conta.atualizado_por == admin
    assert conta.sistema is False  # não se marca "do sistema" pela API
    assert resposta.data["tipo_nome"] == "Saída"
    assert resposta.data["classificacao_dre_nome"] == "Utilidades"
    assert resposta.data["conta_origem_nome"] == "Saídas"


def test_conta_do_sistema_nao_exclui(admin):
    api = cliente_logado(admin)
    sistema = ContaGerencial.objects.create(tipo="S", nome="Pessoal", sistema=True)
    resposta = api.delete(f"/api/contas-gerenciais/{sistema.pk}")
    assert resposta.status_code == 400
    assert "sistema" in resposta.data["detail"]
    assert ContaGerencial.objects.filter(pk=sistema.pk).exists()

    da_rdx = ContaGerencial.objects.create(tipo="S", nome="Estacionamento")
    assert api.delete(f"/api/contas-gerenciais/{da_rdx.pk}").status_code == 204


def test_conta_gerencial_nao_fica_dentro_dela_mesma(admin):
    pai = ContaGerencial.objects.create(tipo="S", nome="Saídas")
    filha = ContaGerencial.objects.create(tipo="S", nome="Água", conta_origem=pai)
    resposta = cliente_logado(admin).patch(f"/api/contas-gerenciais/{pai.pk}", {"conta_origem": filha.pk}, format="json")
    assert resposta.status_code == 400
    assert "conta_origem" in resposta.data


def test_so_uma_conta_principal(admin):
    api = cliente_logado(admin)
    banco = Banco.objects.create(codigo="001", nome="Banco do Brasil")
    caixa = ContaCorrente.objects.create(nome="Caixa", interna=True, principal=True)
    resposta = api.post(
        "/api/contas-correntes",
        {"nome": "BB", "banco": banco.pk, "agencia": "1234", "agencia_digito": "5", "conta": "9876", "conta_digito": "0", "principal": True},
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    assert resposta.data["banco_nome"] == "001 - Banco do Brasil"
    caixa.refresh_from_db()
    assert caixa.principal is False
    assert ContaCorrente.objects.filter(principal=True).count() == 1

    api.patch(f"/api/contas-correntes/{caixa.pk}", {"principal": True}, format="json")
    assert list(ContaCorrente.objects.filter(principal=True).values_list("pk", flat=True)) == [caixa.pk]


def test_bancos_somente_leitura(admin):
    Banco.objects.create(codigo="341", nome="Itaú")
    api = cliente_logado(admin)
    assert api.get("/api/bancos").json() == [{"id": Banco.objects.get().pk, "codigo": "341", "nome": "Itaú"}]
    assert api.post("/api/bancos", {"codigo": "1", "nome": "x"}, format="json").status_code == 405


def test_tipo_pagamento_com_condicoes(admin):
    api = cliente_logado(admin)
    resposta = api.post(
        "/api/tipos-pagamento",
        {
            "descricao": "Cartão de crédito", "carencia": 30, "ativo": True,
            "condicoes": [
                {"descricao": "À vista", "parcelas": 1, "percentual_adm": "2.50"},
                {"descricao": "Entrada + 02x sem juros", "parcelas": 3, "intervalo": 30, "primeira_parcela": 0},
            ],
        },
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    tipo = TipoPagamento.objects.get(pk=resposta.data["id"])
    assert tipo.criado_por == admin
    assert [c.descricao for c in tipo.condicoes.all()] == ["À vista", "Entrada + 02x sem juros"]
    a_vista = tipo.condicoes.get(descricao="À vista")
    assert str(a_vista.percentual_adm) == "2.50"
    assert a_vista.criado_por == admin

    # Atualiza: altera a 1ª (mantém o ID), remove a 2ª e inclui uma nova.
    resposta = api.patch(
        f"/api/tipos-pagamento/{tipo.pk}",
        {"condicoes": [
            {"id": a_vista.pk, "descricao": "À vista", "parcelas": 1, "percentual_adm": "3.00"},
            {"descricao": "Sem entrada + 02x", "parcelas": 2, "intervalo": 30, "primeira_parcela": 30},
        ]},
        format="json",
    )
    assert resposta.status_code == 200, resposta.data
    assert CondicaoPagamento.objects.filter(tipo=tipo).count() == 2
    a_vista.refresh_from_db()
    assert str(a_vista.percentual_adm) == "3.00"
    assert not CondicaoPagamento.objects.filter(descricao="Entrada + 02x sem juros").exists()

    # PATCH sem "condicoes" não mexe nelas.
    api.patch(f"/api/tipos-pagamento/{tipo.pk}", {"ativo": False}, format="json")
    assert CondicaoPagamento.objects.filter(tipo=tipo).count() == 2


def test_condicao_exige_ao_menos_uma_parcela(admin):
    resposta = cliente_logado(admin).post(
        "/api/tipos-pagamento",
        {"descricao": "Boleto", "condicoes": [{"descricao": "x", "parcelas": 0}]},
        format="json",
    )
    assert resposta.status_code == 400
    assert "parcelas" in resposta.data["condicoes"][0]


def test_fim_de_contrato_antes_do_inicio(admin):
    resposta = cliente_logado(admin).post(
        "/api/tipos-pagamento",
        {"descricao": "Boleto", "inicio_contrato": "2026-05-01", "fim_contrato": "2026-01-01"},
        format="json",
    )
    assert resposta.status_code == 400
    assert "fim_contrato" in resposta.data


@pytest.mark.django_db
def test_carregar_bancos_usa_codigo_de_3_digitos_e_atualiza(monkeypatch):
    from django.core.management import call_command

    from apps.financeiro.management.commands import carregar_bancos

    lista = [
        {"code": 1, "fullName": "Banco do Brasil S.A.", "name": "BCO DO BRASIL S.A."},
        {"code": None, "fullName": "Banco Central do Brasil - Selic", "name": "Selic"},
        {"code": 260, "fullName": "NU PAGAMENTOS S.A.", "name": "NU PAGAMENTOS - IP"},
    ]
    monkeypatch.setattr(carregar_bancos, "buscar_json", lambda url: lista)
    call_command("carregar_bancos")
    lista[0]["fullName"] = "Banco do Brasil"
    call_command("carregar_bancos")

    from apps.financeiro.models import Banco

    assert sorted(Banco.objects.values_list("codigo", flat=True)) == ["001", "260"]
    assert Banco.objects.get(codigo="001").nome == "Banco do Brasil"
