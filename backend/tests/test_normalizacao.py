import json
from pathlib import Path

import pytest

from apps.core.normalizacao import PARTICULAS, ROMANOS, SIGLAS, normalizar_nome

# Montado pelo docker-compose.yml a partir de skills/normalizar-nomes/casos.json.
CASOS = json.loads(Path("/casos/normalizar-nomes.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("caso", CASOS["casos"], ids=lambda caso: caso["entrada"] or "(vazio)")
def test_casos_oficiais(caso):
    assert normalizar_nome(caso["entrada"]) == caso["esperado"]


@pytest.mark.parametrize("caso", CASOS["casos"], ids=lambda caso: caso["entrada"] or "(vazio)")
def test_idempotente(caso):
    assert normalizar_nome(caso["esperado"]) == caso["esperado"]


def test_listas_iguais_ao_casos_json():
    assert PARTICULAS == set(CASOS["particulas"])
    assert SIGLAS == set(CASOS["siglas"])
    assert ROMANOS == set(CASOS["romanos"])


def test_nulo_continua_nulo():
    assert normalizar_nome(None) is None
