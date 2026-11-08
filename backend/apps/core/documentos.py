"""
Documentos e contatos: limpeza, validação e formatação (context/regras-de-negocio/formatos.md).

No banco os valores ficam LIMPOS (só dígitos; CNPJ com letras maiúsculas e dígitos).
A máscara é só de exibição. Mesmas regras em frontend/src/lib/mascaras.ts.
"""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

_NAO_DIGITO = re.compile(r"\D")
_NAO_ALFANUMERICO = re.compile(r"[^0-9A-Z]")


def so_digitos(valor: str | None) -> str:
    return _NAO_DIGITO.sub("", valor or "")


def limpar_cnpj(valor: str | None) -> str:
    """CNPJ antigo (14 dígitos) ou alfanumérico (12 letras/dígitos + 2 dígitos verificadores)."""
    return _NAO_ALFANUMERICO.sub("", (valor or "").upper())


def limpar_rg(valor: str | None) -> str:
    """RG: dígitos e o "X" do dígito verificador de alguns estados."""
    return re.sub(r"[^0-9X]", "", (valor or "").upper())


def cpf_valido(cpf: str) -> bool:
    cpf = so_digitos(cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            return False
    return True


def cnpj_valido(cnpj: str) -> bool:
    """
    Vale para o CNPJ numérico e o alfanumérico (Receita Federal, a partir de 2026):
    cada caractere vale (código ASCII − 48), então "0"–"9" = 0–9 e "A" = 17.
    """
    cnpj = limpar_cnpj(cnpj)
    if len(cnpj) != 14 or not cnpj[12:].isdigit() or cnpj == cnpj[0] * 14:
        return False
    valores = [ord(c) - 48 for c in cnpj]
    for tamanho in (12, 13):
        pesos = [(tamanho - 1 - i) % 8 + 2 for i in range(tamanho)]  # 5,4,3,2,9,8,… / 6,5,4,3,2,9,…
        resto = sum(v * p for v, p in zip(valores[:tamanho], pesos)) % 11
        digito = 0 if resto < 2 else 11 - resto
        if digito != valores[tamanho]:
            return False
    return True


# ---- Formatação (exibição em textos gerados no servidor: PDFs, e-mails, admin) ----


def formatar_cpf(cpf: str) -> str:
    d = so_digitos(cpf)
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}" if len(d) == 11 else cpf


def formatar_cnpj(cnpj: str) -> str:
    c = limpar_cnpj(cnpj)
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}" if len(c) == 14 else cnpj


def formatar_cep(cep: str) -> str:
    d = so_digitos(cep)
    return f"{d[:5]}-{d[5:]}" if len(d) == 8 else cep


def formatar_telefone(telefone: str) -> str:
    d = so_digitos(telefone)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return telefone


# ---- Campos de serializador: recebem com ou sem máscara, gravam limpos e validados ----


class _CampoLimpo(serializers.CharField):
    def __init__(self, **kwargs):
        kwargs.setdefault("allow_blank", True)
        kwargs.setdefault("required", False)
        super().__init__(**kwargs)


class CpfField(_CampoLimpo):
    def to_internal_value(self, data):
        valor = so_digitos(super().to_internal_value(data))
        if valor and not cpf_valido(valor):
            raise serializers.ValidationError("CPF inválido. Confira os 11 dígitos.")
        return valor


class CnpjField(_CampoLimpo):
    def to_internal_value(self, data):
        valor = limpar_cnpj(super().to_internal_value(data))
        if valor and not cnpj_valido(valor):
            raise serializers.ValidationError("CNPJ inválido. Confira os 14 caracteres (os 2 últimos são números).")
        return valor


class TelefoneField(_CampoLimpo):
    def to_internal_value(self, data):
        valor = so_digitos(super().to_internal_value(data))
        if valor and len(valor) not in (10, 11):
            raise serializers.ValidationError("Telefone inválido. Use DDD + número: 10 dígitos (fixo) ou 11 (celular).")
        return valor


class CepField(_CampoLimpo):
    def to_internal_value(self, data):
        valor = so_digitos(super().to_internal_value(data))
        if valor and len(valor) != 8:
            raise serializers.ValidationError("CEP inválido. Confira os 8 dígitos.")
        return valor


class RgField(_CampoLimpo):
    def to_internal_value(self, data):
        return limpar_rg(super().to_internal_value(data))


# ---- Validadores de modelo: valem também no painel interno e nas importações ----


def validar_cpf(valor: str) -> None:
    if valor and not cpf_valido(valor):
        raise DjangoValidationError("CPF inválido. Confira os 11 dígitos.", code="cpf_invalido")


def validar_cnpj(valor: str) -> None:
    if valor and not cnpj_valido(valor):
        raise DjangoValidationError("CNPJ inválido. Confira os 14 caracteres (os 2 últimos são números).", code="cnpj_invalido")
