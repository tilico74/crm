"""
Consulta de CEP (ViaCEP) e de estados e municípios (IBGE) para os cadastros.

O front-end nunca chama esses serviços direto: passa pelo back-end, que padroniza a
resposta, guarda em cache e devolve erros em português (context/decisoes/ADR-006).
"""

import gzip
import hashlib
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.core.cache import cache
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

VIACEP = "https://viacep.com.br/ws"
IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades"
TIMEOUT = 8  # segundos

UM_DIA = 60 * 60 * 24
CACHE_CEP = 7 * UM_DIA
CACHE_IBGE = 30 * UM_DIA  # estados e municípios quase nunca mudam

UFS = {
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB",
    "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
}


class ServicoIndisponivel(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Serviço de consulta indisponível no momento. Preencha o endereço manualmente."
    default_code = "servico_indisponivel"


def buscar_json(url: str):
    """GET com tempo limite. O IBGE responde em gzip mesmo sem pedir."""
    requisicao = Request(url, headers={"Accept": "application/json", "User-Agent": "RDX-CRM/1.0"})
    try:
        with urlopen(requisicao, timeout=TIMEOUT) as resposta:
            corpo = resposta.read()
    except (HTTPError, URLError, TimeoutError) as erro:
        raise ServicoIndisponivel() from erro
    if corpo[:2] == b"\x1f\x8b":
        corpo = gzip.decompress(corpo)
    return json.loads(corpo)


def _com_cache(chave: str, segundos: int, buscar):
    dados = cache.get(chave)
    if dados is None:
        dados = buscar()
        cache.set(chave, dados, segundos)
    return dados


def _endereco(item: dict) -> dict:
    """Resposta do ViaCEP com os nomes de campo do RDX."""
    return {
        "cep": item.get("cep", ""),
        "logradouro": item.get("logradouro", ""),
        "complemento": item.get("complemento", ""),
        "bairro": item.get("bairro", ""),
        "cidade": item.get("localidade", ""),
        "uf": item.get("uf", ""),
        "ibge": item.get("ibge", ""),
        "ddd": item.get("ddd", ""),
    }


def _uf_valida(uf: str) -> str:
    uf = uf.upper()
    if uf not in UFS:
        raise serializers.ValidationError({"uf": f'UF "{uf}" não existe. Use a sigla do estado, ex.: SC.'})
    return uf


def consultar_cep(cep: str) -> dict:
    digitos = re.sub(r"\D", "", cep)
    if len(digitos) != 8:
        raise serializers.ValidationError({"cep": "CEP inválido. Confira os 8 dígitos."})
    dados = _com_cache(f"localidades:cep:{digitos}", CACHE_CEP, lambda: buscar_json(f"{VIACEP}/{digitos}/json/"))
    if dados.get("erro"):
        raise NotFound("CEP não encontrado. Confira o número ou preencha o endereço manualmente.")
    return _endereco(dados)


def pesquisar_enderecos(uf: str, cidade: str, logradouro: str) -> list[dict]:
    uf = _uf_valida(uf)
    cidade, logradouro = cidade.strip(), logradouro.strip()
    erros = {}
    # Regra do ViaCEP: cidade e logradouro com pelo menos 3 letras.
    if len(cidade) < 3:
        erros["cidade"] = "Informe a cidade com pelo menos 3 letras."
    if len(logradouro) < 3:
        erros["logradouro"] = "Informe a rua com pelo menos 3 letras."
    if erros:
        raise serializers.ValidationError(erros)
    url = f"{VIACEP}/{uf}/{quote(cidade)}/{quote(logradouro)}/json/"
    # Resumo na chave: cidade e rua têm espaços e acentos.
    chave = "localidades:endereco:" + hashlib.sha1(f"{uf}|{cidade}|{logradouro}".lower().encode()).hexdigest()
    dados = _com_cache(chave, CACHE_CEP, lambda: buscar_json(url))
    return [_endereco(item) for item in dados] if isinstance(dados, list) else []


def listar_estados() -> list[dict]:
    dados = _com_cache("localidades:estados", CACHE_IBGE, lambda: buscar_json(f"{IBGE}/estados?orderBy=nome"))
    return [{"id": e["id"], "sigla": e["sigla"], "nome": e["nome"], "regiao": e["regiao"]["nome"]} for e in dados]


def listar_municipios(uf: str) -> list[dict]:
    """Aceita a sigla (SC) ou o código IBGE do estado (42)."""
    uf = uf if uf.isdigit() else _uf_valida(uf)
    dados = _com_cache(
        f"localidades:municipios:{uf}", CACHE_IBGE, lambda: buscar_json(f"{IBGE}/estados/{uf}/municipios?orderBy=nome")
    )
    if not dados:
        raise NotFound("Estado não encontrado.")
    return [{"id": m["id"], "nome": m["nome"]} for m in dados]


# Endpoints: só exigem login; não há funcionalidade própria na matriz de permissões.


class CepView(APIView):
    def get(self, request, cep):
        return Response(consultar_cep(cep))


class EnderecosView(APIView):
    def get(self, request):
        p = request.query_params
        return Response(pesquisar_enderecos(p.get("uf", ""), p.get("cidade", ""), p.get("logradouro", "")))


class EstadosView(APIView):
    def get(self, request):
        return Response(listar_estados())


class MunicipiosView(APIView):
    def get(self, request, uf):
        return Response(listar_municipios(uf))
