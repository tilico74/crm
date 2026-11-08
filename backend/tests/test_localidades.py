import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core import localidades
from apps.usuarios.models import Usuario

pytestmark = pytest.mark.django_db

VIACEP_SE = {
    "cep": "01001-000", "logradouro": "Praça da Sé", "complemento": "lado ímpar", "unidade": "",
    "bairro": "Sé", "localidade": "São Paulo", "uf": "SP", "estado": "São Paulo", "ibge": "3550308", "ddd": "11",
}
IBGE_ESTADOS = [{"id": 12, "sigla": "AC", "nome": "Acre", "regiao": {"id": 1, "sigla": "N", "nome": "Norte"}}]
IBGE_MUNICIPIOS = [{"id": 4200051, "nome": "Abdon Batista", "microrregiao": {}}]


@pytest.fixture(autouse=True)
def cache_em_memoria(settings):
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    cache.clear()


@pytest.fixture
def api():
    cliente = APIClient()
    cliente.force_authenticate(Usuario.objects.create_user("u", password="x"))
    return cliente


@pytest.fixture
def externo(monkeypatch):
    """Substitui a chamada HTTP; registra as URLs pedidas."""
    chamadas = []

    def fake(respostas):
        def buscar(url):
            chamadas.append(url)
            for trecho, dados in respostas.items():
                if trecho in url:
                    return dados
            raise AssertionError(f"URL inesperada: {url}")

        monkeypatch.setattr(localidades, "buscar_json", buscar)
        return chamadas

    return fake


def test_exige_login():
    assert APIClient().get("/api/localidades/estados").status_code == 401


def test_cep_traduz_campos_e_usa_cache(api, externo):
    chamadas = externo({"/01001000/": VIACEP_SE})
    primeira = api.get("/api/localidades/cep/01001-000")
    assert primeira.status_code == 200
    assert primeira.json() == {
        "cep": "01001-000", "logradouro": "Praça da Sé", "complemento": "lado ímpar", "bairro": "Sé",
        "cidade": "São Paulo", "uf": "SP", "ibge": "3550308", "ddd": "11",
    }
    api.get("/api/localidades/cep/01001000")
    assert len(chamadas) == 1  # a segunda veio do cache


def test_cep_invalido_e_inexistente(api, externo):
    externo({"/99999999/": {"erro": "true"}})
    assert api.get("/api/localidades/cep/123").status_code == 400
    resposta = api.get("/api/localidades/cep/99999999")
    assert resposta.status_code == 404
    assert "CEP não encontrado" in resposta.json()["detail"]


def test_pesquisa_por_endereco(api, externo):
    chamadas = externo({"/RS/Porto%20Alegre/Domingos/": [VIACEP_SE]})
    resposta = api.get("/api/localidades/enderecos", {"uf": "rs", "cidade": "Porto Alegre", "logradouro": "Domingos"})
    assert resposta.status_code == 200
    assert resposta.json()[0]["cidade"] == "São Paulo"
    assert chamadas == ["https://viacep.com.br/ws/RS/Porto%20Alegre/Domingos/json/"]


def test_pesquisa_valida_parametros(api):
    resposta = api.get("/api/localidades/enderecos", {"uf": "XX", "cidade": "Po", "logradouro": "Do"})
    assert resposta.status_code == 400
    resposta = api.get("/api/localidades/enderecos", {"uf": "RS", "cidade": "Po", "logradouro": "Do"})
    assert set(resposta.json()) == {"cidade", "logradouro"}


def test_estados_e_municipios(api, externo):
    externo({"/estados?orderBy=nome": IBGE_ESTADOS, "/estados/SC/municipios": IBGE_MUNICIPIOS})
    assert api.get("/api/localidades/estados").json() == [{"id": 12, "sigla": "AC", "nome": "Acre", "regiao": "Norte"}]
    assert api.get("/api/localidades/estados/sc/municipios").json() == [{"id": 4200051, "nome": "Abdon Batista"}]


def test_servico_fora_do_ar_devolve_503(api, monkeypatch):
    def fora(url):
        raise localidades.ServicoIndisponivel()

    monkeypatch.setattr(localidades, "buscar_json", fora)
    resposta = api.get("/api/localidades/cep/01001000")
    assert resposta.status_code == 503
    assert "manualmente" in resposta.json()["detail"]
