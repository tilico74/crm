import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.catalogo.models import Categoria, Marca, Produto, Subcategoria, Unidade
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


def _produto(api, **extra):
    corpo = {"descricao": "Batente alumínio Prime Kids Anodizado", "unidade": 1, "preco_custo": "137.85", "preco_venda": "260.00", **extra}
    return api.post("/api/produtos", corpo, format="json")


def test_produto_grava_descricao_como_veio_e_fiscal_limpo(admin):
    api, usuario = admin
    resposta = _produto(api, codigo_barras="4000000000001", ncm="5608.19.00", cest="01.020.00", origem=0, tags=["Protectpool", " Protectpool ", "Cerca"])
    assert resposta.status_code == 201, resposta.data
    produto = Produto.objects.get(pk=resposta.data["id"])
    assert produto.descricao == "Batente alumínio Prime Kids Anodizado"  # sem padronizar
    assert (produto.ncm, produto.cest) == ("56081900", "0102000")
    assert produto.tags == ["Protectpool", "Cerca"]
    assert produto.criado_por == usuario


def test_produto_valida_ncm_codigo_de_barras_e_subcategoria(admin):
    api, _ = admin
    assert _produto(api, ncm="1234").status_code == 400
    assert _produto(api, codigo_barras="789").status_code == 201
    assert _produto(api, codigo_barras="789").status_code == 400  # não repete
    rede = Categoria.objects.create(nome="Rede")
    cerca = Categoria.objects.create(nome="Cerca")
    sub = Subcategoria.objects.create(categoria=cerca, nome="Batente")
    resposta = _produto(api, categoria=rede.id, subcategoria=sub.id)
    assert resposta.status_code == 400 and "subcategoria" in resposta.data


def test_kit_com_composicao(admin):
    api, _ = admin
    a = _produto(api).data
    b = _produto(api, descricao="Haste").data
    kit = _produto(api, descricao="Kit cerca", tipo_item="kit", composicao=[{"item": a["id"], "quantidade": "2"}, {"item": b["id"], "quantidade": "1.5", "unidade": 1}]).data
    assert [(c["item_descricao"], c["quantidade"]) for c in kit["composicao"]] == [(a["descricao"], "2.000"), ("Haste", "1.500")]
    assert kit["composicao"][0]["item_custo"] == "137.85"
    # Item usado num kit não pode ser excluído.
    assert api.delete(f"/api/produtos/{a['id']}").status_code == 400
    # Kit não contém ele mesmo.
    assert api.patch(f"/api/produtos/{kit['id']}", {"composicao": [{"item": kit["id"], "quantidade": "1"}]}, format="json").status_code == 400


def test_fragmentacao_tudo_ou_nada(admin):
    api, _ = admin
    metro = Unidade.objects.get(sigla="UN")
    incompleta = _produto(api, fragmentacao_quantidade="50")
    assert incompleta.status_code == 400
    assert {"fragmentacao_unidade", "fragmentacao_preco"} <= set(incompleta.data)
    completa = _produto(api, fragmentacao_quantidade="50", fragmentacao_unidade=metro.id, fragmentacao_preco="12.00")
    assert completa.status_code == 201, completa.data
    assert (completa.data["fragmentacao_quantidade"], completa.data["fragmentacao_unidade_sigla"], completa.data["fragmentacao_preco"]) == ("50.000", "UN", "12.00")
    # Limpar os três campos tira a venda fracionada.
    limpa = api.patch(f"/api/produtos/{completa.data['id']}", {"fragmentacao_quantidade": None, "fragmentacao_unidade": None, "fragmentacao_preco": None}, format="json")
    assert limpa.status_code == 200 and limpa.data["fragmentacao_unidade"] is None


def test_servico_e_filtro_sem_ncm(admin):
    api, _ = admin
    servico = api.post("/api/servicos", {"nome": "Mão de obra de instalação de redes de proteção (saída mínima)", "unidade": 1, "preco_venda": "100.00"}, format="json")
    assert servico.status_code == 201 and servico.data["unidade_sigla"] == "UN"
    _produto(api, ncm="56081900")
    _produto(api, descricao="Sem NCM")
    sem_ncm = api.get("/api/produtos", {"sem_ncm": 1}).json()
    assert [p["descricao"] for p in sem_ncm["results"]] == ["Sem NCM"]


def test_permissoes_do_catalogo():
    grupo = Grupo.objects.get(nome="Vendedor")
    usuario = Usuario.objects.create_user("vend", password="x", grupo=grupo)
    api = APIClient()
    api.force_authenticate(usuario)
    assert api.get("/api/marcas").status_code == 403
    PermissaoGrupo.objects.create(grupo=grupo, funcionalidade=Funcionalidade.objects.get(codigo="produtos"), acessar=True)
    assert api.get("/api/subcategorias").status_code == 200  # leitura liberada para quem cadastra produto
    assert api.post("/api/marcas", {"nome": "X"}).status_code == 403
