import json

import openpyxl
import pytest
from django.core.management import call_command

from apps.catalogo.models import Categoria, Produto, Servico, Subcategoria, Unidade

pytestmark = pytest.mark.django_db

CABECALHO = ["Código de Barras", "Tipo de Produto", "Descrição", "Unidade", "Tipo", "NCM", "Origem", "CEST", "Tags", "Código Balança", "Movimenta Estoque"]


def arquivos(tmp_path):
    lista = [
        {"ItemID": 23, "BarCode": "2000000000020", "Name": "Instalação rede 5x5", "Cost": 10, "SaleValue": 55, "WholesaleValue": 0,
         "WholesaleAmount": 0, "IsActive": True, "CategoryID": 4, "CategoryName": "Rede", "SubcategoryID": None},
        {"ItemID": 88, "BarCode": "4000000000001", "Name": "Batente alumínio", "Cost": 137.85, "SaleValue": 260, "IsActive": True,
         "CategoryID": 3, "CategoryName": "Cerca de Piscina", "SubcategoryID": 1, "SubcategoryName": "Batente"},
    ]
    (tmp_path / "p.json").write_text(json.dumps(lista), encoding="utf-8")
    livro = openpyxl.Workbook()
    livro.active.append(CABECALHO)
    livro.active.append(["2000000000020", "Produto", "Instalação rede 5x5", "M²", "Mercadoria para Revenda", "5608.19.00", "NACIONAL", None, None, None, "Não"])
    livro.active.append(["4000000000001", "Kit", "Batente alumínio", "Unidade", None, None, None, None, None, None, "Não"])
    livro.save(tmp_path / "p.xlsx")
    servicos = [{"ServiceID": 28, "ItemUnitID": 1, "Barcode": "2000000000026", "Name": "Mão de obra", "Value": 100, "Cost": 0, "Active": True}]
    (tmp_path / "s.json").write_text(json.dumps(servicos), encoding="utf-8")
    return str(tmp_path / "p.json"), str(tmp_path / "p.xlsx"), str(tmp_path / "s.json")


def test_importa_catalogo_com_ids_da_marketup(tmp_path):
    lista, planilha, servicos = arquivos(tmp_path)
    call_command("importar_produtos", lista, planilha)
    call_command("importar_produtos", lista, planilha)  # recarga não duplica
    assert Unidade.objects.get(pk=6).sigla == "M²" and Unidade.objects.get(pk=10).sigla == "BR"
    rede = Produto.objects.get(pk=23)
    assert rede.unidade_id == 6 and str(rede.preco_venda) == "55.00" and rede.ncm == "56081900"
    assert rede.tipo_fiscal == "revenda" and rede.origem == 0 and rede.categoria.nome == "Rede"
    batente = Produto.objects.get(pk=88)
    assert batente.tipo_item == "kit" and batente.subcategoria == Subcategoria.objects.get(pk=1, categoria=Categoria.objects.get(pk=3))
    assert Produto.objects.count() == 2 and Produto.objects.create(descricao="Novo", unidade_id=1).id == 89

    call_command("importar_servicos", servicos)
    assert Servico.objects.get(pk=28).nome == "Mão de obra"
