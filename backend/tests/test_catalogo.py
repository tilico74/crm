import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Marca, Subcategoria, Unidade
from apps.usuarios.models import Funcionalidade, Grupo, PermissaoGrupo, Usuario

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    usuario = Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))
    api = APIClient()
    api.force_authenticate(usuario)
    return api, usuario


def test_unidades_do_sistema_com_ids_da_marketup_e_bloqueadas(admin):
    api, _ = admin
    assert list(Unidade.objects.filter(sistema=True).order_by("id").values_list("id", "sigla")) == [
        (1, "UN"), (2, "CX"), (3, "FD"), (4, "KG"), (5, "HF"),
    ]
    assert api.patch("/api/unidades/1", {"nome": "Outra"}, format="json").status_code == 400
    assert api.delete("/api/unidades/1").status_code == 400
    # A sequência foi ajustada: a próxima unidade não colide com os IDs 1 a 5.
    nova = api.post("/api/unidades", {"sigla": "m2", "nome": "Metro quadrado"}, format="json")
    assert nova.status_code == 201 and nova.data["id"] > 5 and nova.data["sigla"] == "M2"


def test_marca_com_auditoria_e_imagem(admin, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    api, usuario = admin
    marca = api.post("/api/marcas", {"nome": "Protectpool"}, format="json").data
    assert Marca.objects.get(pk=marca["id"]).criado_por == usuario
    png = SimpleUploadedFile("m.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
    resposta = api.post(f"/api/marcas/{marca['id']}/imagem", {"arquivo": png}, format="multipart")
    assert resposta.status_code == 200 and "marcas/" in resposta.data["imagem"]
    assert api.delete(f"/api/marcas/{marca['id']}/imagem").data["imagem"] is None


def test_categoria_grava_subcategorias_sem_trocar_ids(admin):
    api, _ = admin
    criada = api.post(
        "/api/categorias",
        {"nome": "Cerca de Piscina", "subcategorias": [{"nome": "Batente"}, {"nome": "Haste para cerca"}]},
        format="json",
    ).data
    batente, haste = criada["subcategorias"]
    resposta = api.put(
        f"/api/categorias/{criada['id']}",
        {"nome": "Cerca de Piscina", "subcategorias": [{"id": batente["id"], "nome": "Batente alumínio"}, {"nome": "Portão automático"}]},
        format="json",
    )
    assert resposta.status_code == 200, resposta.data
    subs = {s.nome: s.id for s in Subcategoria.objects.filter(categoria_id=criada["id"])}
    assert subs["Batente alumínio"] == batente["id"]  # mesmo ID, nome novo
    assert "Haste para cerca" not in subs  # saiu da lista = excluída
    assert "Portão automático" in subs


def test_categoria_com_subcategorias_nao_exclui(admin):
    api, _ = admin
    cat = Categoria.objects.create(nome="Rede")
    Subcategoria.objects.create(categoria=cat, nome="Rede de nylon")
    assert api.delete(f"/api/categorias/{cat.id}").status_code == 400


def test_permissoes_do_catalogo():
    grupo = Grupo.objects.get(nome="Vendedor")
    usuario = Usuario.objects.create_user("vend", password="x", grupo=grupo)
    api = APIClient()
    api.force_authenticate(usuario)
    assert api.get("/api/marcas").status_code == 403
    PermissaoGrupo.objects.create(grupo=grupo, funcionalidade=Funcionalidade.objects.get(codigo="produtos"), acessar=True)
    assert api.get("/api/subcategorias").status_code == 200  # leitura liberada para quem cadastra produto
    assert api.post("/api/marcas", {"nome": "X"}).status_code == 403
