import pytest
from rest_framework.test import APIClient

from apps.usuarios.models import Funcionario, Grupo, PermissaoGrupo, Usuario

pytestmark = pytest.mark.django_db


def cliente_logado(usuario):
    api = APIClient()
    api.force_authenticate(usuario)
    return api


@pytest.fixture
def vendedor():
    grupo = Grupo.objects.get(nome="Vendedor")
    return Usuario.objects.create_user("vendedor", password="x", grupo=grupo)


@pytest.fixture
def admin():
    return Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))


def test_grupos_da_rdx_criados_pela_migracao():
    nomes = set(Grupo.objects.values_list("nome", flat=True))
    assert "Técnico" in nomes and "Vendedor Redex" in nomes
    assert "Operador PDV" not in nomes


def test_sem_login_nao_acessa():
    assert APIClient().get("/api/funcionarios").status_code == 401


def test_grupo_sem_permissao_nao_acessa(vendedor):
    assert cliente_logado(vendedor).get("/api/funcionarios").status_code == 403


def test_permissao_por_acao(vendedor):
    PermissaoGrupo.objects.create(grupo=vendedor.grupo, funcionalidade_id=_func("funcionarios"), acessar=True)
    api = cliente_logado(vendedor)
    assert api.get("/api/funcionarios").status_code == 200
    assert api.post("/api/funcionarios", {"nome": "x"}).status_code == 403


def test_grupo_inativo_perde_acesso(admin):
    admin.grupo.ativo = False
    admin.grupo.save()
    assert cliente_logado(admin).get("/api/funcionarios").status_code == 403


def test_cria_funcionario_com_login_e_auditoria(admin):
    api = cliente_logado(admin)
    resposta = api.post(
        "/api/funcionarios",
        {"nome": "JOÃO DA SILVA", "login": "joao", "senha": "Senha-forte-123", "grupo": admin.grupo_id, "vendedor": True, "comissao": "5.00"},
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    funcionario = Funcionario.objects.get(pk=resposta.data["id"])
    assert funcionario.nome == "João da Silva"
    assert funcionario.criado_por == admin and funcionario.atualizado_por == admin
    assert funcionario.usuario.username == "joao"
    assert funcionario.usuario.check_password("Senha-forte-123")
    assert "senha" not in resposta.data


def test_login_novo_exige_senha(admin):
    resposta = cliente_logado(admin).post("/api/funcionarios", {"nome": "Ana", "login": "ana"}, format="json")
    assert resposta.status_code == 400
    assert "senha" in resposta.data


def test_bloquear_funcionario_desativa_login(admin):
    api = cliente_logado(admin)
    criado = api.post("/api/funcionarios", {"nome": "Ana", "login": "ana", "senha": "Senha-forte-123"}, format="json").data
    api.patch(f"/api/funcionarios/{criado['id']}", {"bloqueado": True}, format="json")
    assert not Usuario.objects.get(username="ana").is_active


def test_matriz_de_permissoes_grava_e_le(admin):
    api = cliente_logado(admin)
    grupo = Grupo.objects.get(nome="Técnico")
    linhas = [{"funcionalidade": "ordens_servico", "acessar": True, "adicionar": False, "alterar": True, "excluir": False}]
    assert api.put(f"/api/grupos/{grupo.pk}/permissoes", linhas, format="json").status_code == 200
    assert api.get(f"/api/grupos/{grupo.pk}/permissoes").json() == linhas


def test_me_traz_nome_e_permissoes(vendedor):
    PermissaoGrupo.objects.create(grupo=vendedor.grupo, funcionalidade_id=_func("crm"), acessar=True, adicionar=True)
    Funcionario.objects.create(nome="maria dos santos", usuario=vendedor)
    dados = cliente_logado(vendedor).get("/api/auth/me").json()
    assert dados["nome"] == "Maria dos Santos"
    assert dados["grupo"] == "Vendedor"
    assert dados["permissoes"] == {"crm": ["acessar", "adicionar"]}


def _func(codigo):
    from apps.usuarios.models import Funcionalidade

    return Funcionalidade.objects.get(codigo=codigo).pk


def test_quem_cadastra_funcionario_le_grupos_mas_nao_altera(vendedor):
    PermissaoGrupo.objects.create(grupo=vendedor.grupo, funcionalidade_id=_func("funcionarios"), acessar=True)
    api = cliente_logado(vendedor)
    assert api.get("/api/grupos").status_code == 200
    assert api.post("/api/grupos", {"nome": "Novo"}).status_code == 403


def test_excluir_funcionario_desativa_login(admin):
    api = cliente_logado(admin)
    criado = api.post("/api/funcionarios", {"nome": "Ana", "login": "ana", "senha": "Senha-forte-123"}, format="json").data
    assert api.delete(f"/api/funcionarios/{criado['id']}").status_code == 204
    assert not Usuario.objects.get(username="ana").is_active


def test_nao_exclui_grupo_com_usuarios(admin):
    resposta = cliente_logado(admin).delete(f"/api/grupos/{admin.grupo_id}")
    assert resposta.status_code == 400
    assert Grupo.objects.filter(pk=admin.grupo_id).exists()
