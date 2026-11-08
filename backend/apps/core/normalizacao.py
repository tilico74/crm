"""Padronização de nomes próprios e endereços (skills/normalizar-nomes/SKILL.md).

As listas abaixo espelham skills/normalizar-nomes/casos.json; os testes garantem
que continuam iguais. Mesma regra em frontend/src/lib/normalizarNome.ts.
"""

import re

PARTICULAS = frozenset(
    "a as com da das de del della di do dos du e em na nas no nos o os para por van von y".split()
)
SIGLAS = frozenset(
    ["CIA", "CNPJ", "CPF", "EIRELI", "EPI", "EPP", "LTDA", "ME", "MEI", "ONG", "RDX", "S.A.", "S/A", "SA"]
)
ROMANOS = frozenset(
    "X V I XX II IV IX XV XI VI VII III XII XIV VIII XIII".split()
)

_RODOVIA = re.compile(r"^[^\W\d_]+-\d+$")
_PONTUACAO_FINAL = re.compile(r"[,;]+$")


def _capitalize(word: str) -> str:
    # Primeira letra maiúscula; depois de "-" ou "'" a próxima também.
    result = []
    upper_next = True
    for char in word:
        result.append(char.upper() if upper_next else char.lower())
        upper_next = char in "-'"
    return "".join(result)


def _normalize_word(word: str, index: int, last: int, siglas: frozenset[str]) -> str:
    if _RODOVIA.match(word) or word.upper() in siglas:
        return word.upper()
    lower = word.lower()
    if index > 0 and word.upper() in ROMANOS:
        return word.upper()
    if 0 < index < last and lower in PARTICULAS:
        return lower
    if index > 0 and lower.startswith("d'"):
        return "d'" + _capitalize(word[2:])
    return _capitalize(word)


def normalizar_nome(texto: str | None, siglas: frozenset[str] = SIGLAS) -> str | None:
    """Vale para nomes de pessoas, empresas e endereços: a regra é a mesma."""
    if texto is None:
        return None
    words = texto.split()
    last = len(words) - 1
    result = []
    for index, word in enumerate(words):
        match = _PONTUACAO_FINAL.search(word)
        suffix = match.group() if match else ""
        core = word[: len(word) - len(suffix)]
        result.append(_normalize_word(core, index, last, siglas) + suffix)
    return " ".join(result)
