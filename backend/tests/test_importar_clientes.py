import openpyxl
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.clientes.models import Cliente
from apps.migracao.management.commands.importar_clientes import COLUNAS

pytestmark = pytest.mark.django_db


def planilha(tmp_path, linhas):
    livro = openpyxl.Workbook()
    folha = livro.active
    folha.append(COLUNAS)
    for linha in linhas:
        folha.append([linha.get(c) for c in COLUNAS])
    caminho = tmp_path / "ListaClientes.xlsx"
    livro.save(caminho)
    return str(caminho)


PF = {
    "Código Sistema": 109, "Nome/Razão Social": "JOÃO da silva", "Tipo (Lista de Preços)": "Padrão", "Sexo (M ou F)": "M",
    "CPF": "529.982.247-25", "Indicador IE Destinatário": "Não Contribuinte", "Telefone": "(48) 3333-4444",
    "Endereço": "Rua A", "Número": "10", "Bairro": "Centro", "Cidade": "São José", "Estado": "SC", "CEP": "88101-370",
    "Data de nascimento": "05/03/1980",
}
PJ = {"Código Sistema": 3295, "Nome/Razão Social": "REDES xyz LTDA", "CNPJ": "11.222.333/0001-81", "Indicador IE Destinatário": "Contribuinte do ICMS", "IE": "123"}


def test_importa_com_id_da_marketup_e_ajusta_sequencia(tmp_path, settings):
    settings.BASE_DIR = tmp_path
    call_command("importar_clientes", planilha(tmp_path, [PF, PJ]), sem_ibge=True)
    pf, pj = Cliente.objects.get(pk=109), Cliente.objects.get(pk=3295)
    assert pf.nome == "João da Silva" and pf.cpf == "52998224725" and pf.telefone == "4833334444"
    assert pf.aniversario.isoformat() == "1980-03-05" and pf.enderecos.get().padrao
    assert pj.tipo_pessoa == "J" and pj.nome == "REDES xyz LTDA" and pj.indicador_ie == 1
    # Próximo cliente cadastrado no RDX não colide com os IDs da MarketUP.
    assert Cliente.objects.create(nome="Novo").id == 3296
    assert list((tmp_path / "logs" / "migracao").glob("clientes-*.csv"))


def test_recarga_atualiza_sem_duplicar(tmp_path, settings):
    settings.BASE_DIR = tmp_path
    call_command("importar_clientes", planilha(tmp_path, [PF]), sem_ibge=True)
    call_command("importar_clientes", planilha(tmp_path, [{**PF, "Número": "20"}]), sem_ibge=True)
    cliente = Cliente.objects.get(pk=109)
    assert cliente.enderecos.count() == 1 and cliente.enderecos.get().numero == "20"


def test_simular_nao_grava_e_planilha_errada_para(tmp_path, settings):
    settings.BASE_DIR = tmp_path
    call_command("importar_clientes", planilha(tmp_path, [PF]), simular=True, sem_ibge=True)
    assert not Cliente.objects.exists()
    livro = openpyxl.Workbook()
    livro.active.append(["Outra", "Planilha"])
    livro.save(tmp_path / "errada.xlsx")
    with pytest.raises(CommandError, match="não tem as colunas"):
        call_command("importar_clientes", str(tmp_path / "errada.xlsx"))
