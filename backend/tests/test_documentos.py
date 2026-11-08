import pytest
from rest_framework import serializers

from apps.core import documentos as d

# CPFs e CNPJs gerados para teste (dígitos verificadores válidos, sem dono real).
CPF_VALIDO = "529.982.247-25"
CNPJ_NUMERICO = "11.222.333/0001-81"
CNPJ_ALFANUMERICO = "12.ABC.345/01DE-35"  # exemplo publicado pela Receita Federal


@pytest.mark.parametrize("cpf", [CPF_VALIDO, "52998224725"])
def test_cpf_valido(cpf):
    assert d.cpf_valido(cpf)


@pytest.mark.parametrize("cpf", ["529.982.247-24", "111.111.111-11", "123", ""])
def test_cpf_invalido(cpf):
    assert not d.cpf_valido(cpf)


@pytest.mark.parametrize("cnpj", [CNPJ_NUMERICO, "11222333000181", CNPJ_ALFANUMERICO, "12abc34501de35"])
def test_cnpj_valido_numerico_e_alfanumerico(cnpj):
    assert d.cnpj_valido(cnpj)


@pytest.mark.parametrize("cnpj", ["11.222.333/0001-80", "12.ABC.345/01DE-36", "00.000.000/0000-00", "12.ABC.345/01DE-3A"])
def test_cnpj_invalido(cnpj):
    assert not d.cnpj_valido(cnpj)


def test_formatacoes():
    assert d.formatar_cpf("52998224725") == CPF_VALIDO
    assert d.formatar_cnpj("12abc34501de35") == CNPJ_ALFANUMERICO
    assert d.formatar_cep("88138152") == "88138-152"
    assert d.formatar_telefone("48999614233") == "(48) 99961-4233"
    assert d.formatar_telefone("4832221234") == "(48) 3222-1234"


def test_campos_gravam_limpos():
    assert d.CpfField().to_internal_value(CPF_VALIDO) == "52998224725"
    assert d.CnpjField().to_internal_value("12.abc.345/01de-35") == "12ABC34501DE35"
    assert d.TelefoneField().to_internal_value("(48) 99961-4233") == "48999614233"
    assert d.CepField().to_internal_value("88138-152") == "88138152"
    assert d.RgField().to_internal_value("12.345.678-x") == "12345678X"
    assert d.CpfField().to_internal_value("") == ""


@pytest.mark.parametrize(
    ("campo", "valor", "trecho"),
    [
        (d.CpfField(), "123.456.789-00", "CPF inválido"),
        (d.CnpjField(), "11.222.333/0001-80", "CNPJ inválido"),
        (d.TelefoneField(), "9999-1234", "DDD"),
        (d.CepField(), "8813-815", "8 dígitos"),
    ],
)
def test_campos_recusam_com_mensagem(campo, valor, trecho):
    with pytest.raises(serializers.ValidationError) as erro:
        campo.to_internal_value(valor)
    assert trecho in str(erro.value)


@pytest.mark.django_db
def test_modelo_recusa_cpf_e_cnpj_invalidos_fora_da_api():
    """Painel interno e importações usam full_clean: a validação vale lá também."""
    from django.core.exceptions import ValidationError

    from apps.core.models import Empresa
    from apps.usuarios.models import Funcionario

    with pytest.raises(ValidationError) as erro:
        Funcionario(nome="Teste", cpf="52998224724", cnpj="11222333000180").full_clean()
    assert set(erro.value.message_dict) == {"cpf", "cnpj"}

    Funcionario(nome="Teste", cpf=CPF_VALIDO, cnpj=CNPJ_ALFANUMERICO).full_clean()
    with pytest.raises(ValidationError):
        Empresa(cnpj="00000000000000").full_clean()
