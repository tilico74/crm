import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.core.models import Empresa
from apps.usuarios.models import Grupo, Usuario
from apps.vendas.models import ParametrosVenda

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    usuario = Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))
    api = APIClient()
    api.force_authenticate(usuario)
    return api, usuario


@pytest.fixture
def vendedor():
    usuario = Usuario.objects.create_user("vend", password="x", grupo=Grupo.objects.get(nome="Vendedor"))
    api = APIClient()
    api.force_authenticate(usuario)
    return api


def test_empresa_traz_os_tres_enderecos_na_ordem(admin):
    api, _ = admin
    dados = api.get("/api/empresa").json()
    assert [e["tipo"] for e in dados["enderecos"]] == ["faturamento", "entregas", "correspondencias"]


def test_empresa_grava_como_digitado_e_auditado(admin):
    api, usuario = admin
    resposta = api.patch(
        "/api/empresa",
        {
            "razao_social": "NELSON CRISTIANO SANTOS JUCOSKI MEI",
            "enderecos": [{"tipo": "faturamento", "logradouro": "RUA DAS FLORES", "cidade": "palhoça", "uf": "sc"}],
        },
        format="json",
    )
    assert resposta.status_code == 200, resposta.data
    empresa = Empresa.atual()
    assert empresa.razao_social == "NELSON CRISTIANO SANTOS JUCOSKI MEI"  # nomes gravados como chegam (ADR-007)
    assert empresa.atualizado_por == usuario
    endereco = empresa.enderecos.get(tipo="faturamento")
    assert (endereco.logradouro, endereco.cidade, endereco.uf) == ("RUA DAS FLORES", "palhoça", "SC")
    assert Empresa.objects.count() == 1


def test_logotipo_aceita_imagem_e_recusa_outro_formato(admin, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    api, _ = admin
    png = SimpleUploadedFile("logo.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
    assert api.post("/api/empresa/logotipo", {"arquivo": png}, format="multipart").status_code == 200
    assert Empresa.atual().logotipo.name.startswith("empresa/")
    pdf = SimpleUploadedFile("logo.pdf", b"%PDF", content_type="application/pdf")
    resposta = api.post("/api/empresa/logotipo", {"arquivo": pdf}, format="multipart")
    assert resposta.status_code == 400
    assert "Formato" in str(resposta.data)


def test_parametros_comecam_com_os_valores_da_marketup(admin):
    api, _ = admin
    dados = api.get("/api/parametros-venda").json()
    assert dados["venda_validade_orcamento"] == 15
    assert dados["limite_credito_novos"] == "1000.00"
    assert dados["metodo_valorizacao_estoque"] == "PEPS"
    assert dados["formato_impressao"] == "A4"


def test_parametros_alterados_e_registro_unico(admin):
    api, usuario = admin
    assert api.patch("/api/parametros-venda", {"venda_validade_orcamento": 30}, format="json").status_code == 200
    assert ParametrosVenda.objects.count() == 1
    parametros = ParametrosVenda.atual()
    assert parametros.venda_validade_orcamento == 30
    assert parametros.atualizado_por == usuario


def test_sem_permissao_nao_ve_nem_altera(vendedor):
    assert vendedor.get("/api/empresa").status_code == 403
    assert vendedor.patch("/api/parametros-venda", {"venda_validade_orcamento": 1}, format="json").status_code == 403
