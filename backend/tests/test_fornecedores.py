import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.compras.models import Fornecedor, TipoFornecedor
from apps.financeiro.models import ContaCorrente, ContaGerencial, ContaPagar
from apps.usuarios.models import Funcionalidade, Grupo, Usuario

pytestmark = pytest.mark.django_db

CNPJ = "11.222.333/0001-81"
CPF = "529.982.247-25"


@pytest.fixture
def api():
    c = APIClient()
    c.force_authenticate(Usuario.objects.create_user("comprador", password="x", grupo=Grupo.objects.get(nome="Administrador")))
    return c


def d(dias=0):
    return (timezone.localdate() + timedelta(days=dias)).isoformat()


def novo(api, **extra):
    corpo = {"tipo_pessoa": "J", "nome": "Equipesca Equipamentos de Pesca LTDA", "apelido": "Equipesca", "cnpj": CNPJ, **extra}
    return api.post("/api/fornecedores", corpo, format="json")


def test_dados_iniciais_da_marketup():
    assert list(TipoFornecedor.objects.order_by("id").values_list("id", "nome")) == [
        (1, "Geral"), (2, "Matéria Prima"), (3, "Material de Escritório"), (4, "Serviços"), (5, "Entregas"),
    ]
    codigos = set(Funcionalidade.objects.values_list("codigo", flat=True))
    assert {"fornecedores", "tipos_fornecedor", "pedidos_compra", "orcamentos_compra", "devolucoes_compra"} <= codigos


def test_ficha_com_abas_e_pix(api):
    r = novo(api, tipo=2, transportadora=True, enderecos=[{"cep": "13080-290", "logradouro": "Rua Henrique Veiga", "numero": "41", "cidade": "Campinas", "uf": "sp"}],
             contatos=[{"nome": "ana souza", "cargo": "Vendas"}], chaves_pix=[{"tipo": 2, "chave": " 11222333000181 "}])
    assert r.status_code == 201, r.data
    f = Fornecedor.objects.get(pk=r.data["id"])
    assert f.tipo_id == 2 and f.transportadora and f.cnpj == "11222333000181"
    assert f.nome == "Equipesca Equipamentos de Pesca LTDA"  # razão social fica como digitada (ADR-007)
    e = f.enderecos.get()
    assert e.padrao and e.uf == "SP" and e.cep == "13080290"
    assert f.contatos.get().nome == "Ana Souza"
    assert r.data["chaves_pix"][0]["tipo_nome"] == "CNPJ" and r.data["chaves_pix"][0]["chave"] == "11222333000181"
    # CNPJ repetido.
    assert "cnpj" in novo(api).data
    # Trocar para física apaga CNPJ e IE (aviso da MarketUP), mantém o que é da física.
    p = api.patch(f"/api/fornecedores/{f.id}", {"tipo_pessoa": "F", "nome": "joão da silva", "cpf": CPF, "inscricao_estadual": "123"}, format="json")
    assert p.status_code == 200, p.data
    f.refresh_from_db()
    assert (f.cnpj, f.inscricao_estadual, f.cpf, f.nome) == ("", "", "52998224725", "João da Silva")


def test_lista_filtros_e_exclusao(api):
    a = novo(api, tipo=5, transportadora=True).data
    b = api.post("/api/fornecedores", {"tipo_pessoa": "J", "nome": "Alubig Comercio LTDA", "email": "ALUBIG@GMAIL.COM", "bloqueado": True}, format="json").data
    assert b["tipo_nome"] == "Geral"  # sem tipo: Geral (SupplierTypeID 1)
    lista = api.get("/api/fornecedores?ordering=nome").data["results"]
    assert [x["nome"] for x in lista] == ["Alubig Comercio LTDA", "Equipesca Equipamentos de Pesca LTDA"]
    assert [x["id"] for x in api.get("/api/fornecedores?tipo=5").data["results"]] == [a["id"]]
    assert [x["id"] for x in api.get("/api/fornecedores?transportadora=true").data["results"]] == [a["id"]]
    assert [x["id"] for x in api.get("/api/fornecedores?bloqueado=true").data["results"]] == [b["id"]]
    assert [x["id"] for x in api.get("/api/fornecedores?search=11222333").data["results"]] == [a["id"]]
    # Tipo em uso e o Geral não saem.
    assert api.delete("/api/tipos-fornecedor/5").status_code == 400
    assert api.delete("/api/tipos-fornecedor/1").status_code == 400
    assert api.delete("/api/tipos-fornecedor/3").status_code == 204
    # Fornecedor com conta a pagar não sai; sem movimento, sai.
    g = ContaGerencial.objects.create(id=58, nome="Compras", tipo="S", classificacao_dre="")
    ContaPagar.objects.create(fornecedor_id=a["id"], descricao="Pedido de Compra Nº 1", conta_gerencial=g, emissao=d(), vencimento=d(), valor=10, saldo=10)
    assert api.delete(f"/api/fornecedores/{a['id']}").status_code == 400
    assert api.delete(f"/api/fornecedores/{b['id']}").status_code == 204


def test_aba_financeiro_e_conta_a_pagar_do_fornecedor(api):
    f = novo(api).data
    g = ContaGerencial.objects.create(id=58, nome="Compras", tipo="S", classificacao_dre="")
    caixa = ContaCorrente.objects.create(id=1, nome="Caixa", interna=True)
    criar = lambda desc, venc, valor: api.post("/api/contas-pagar", {  # noqa: E731
        "descricao": desc, "conta_gerencial": g.id, "emissao": d(-40), "vencimento": venc, "valor": valor, "fornecedor": f["id"],
    }, format="json")
    vencida = criar("Pedido de Compra Nº 245", d(-5), "937.79")
    assert vencida.status_code == 201, vencida.data
    assert vencida.data["pessoa_nome"] == "Equipesca Equipamentos de Pesca LTDA" and vencida.data["fornecedor_nome"]
    criar("Pedido de Compra Nº 246", d(10), "100")
    paga = criar("Pedido de Compra Nº 2", d(-30), "2038.71").data
    api.patch(f"/api/contas-pagar/{paga['id']}", {"novas_baixas": [{"data": d(), "conta_corrente": caixa.id, "valor": "2038.71"}]}, format="json")
    fin = api.get(f"/api/fornecedores/{f['id']}").data["financeiro"]
    assert {k: f"{v:.2f}" for k, v in fin["totais"].items()} == {"vencidas": "937.79", "a_vencer": "100.00", "pagas": "2038.71"}
    assert [c["situacao"] for c in fin["contas"]] == ["paga", "vencida", "a_vencer"]
    # Busca da conta a pagar pelo fornecedor (nome ou fantasia) e filtro.
    assert api.get("/api/contas-pagar?search=Equipesca").data["count"] == 3
    assert api.get(f"/api/contas-pagar?fornecedor={f['id']}&quitadas=0").data["count"] == 2
    # Um beneficiário só.
    from apps.clientes.models import Cliente

    cli = Cliente.objects.create(nome="Ana")
    assert api.patch(f"/api/contas-pagar/{vencida.data['id']}", {"fornecedor": f["id"], "cliente": cli.id}, format="json").status_code == 400
    trocou = api.patch(f"/api/contas-pagar/{vencida.data['id']}", {"cliente": cli.id}, format="json")
    assert trocou.status_code == 200 and trocou.data["fornecedor"] is None and trocou.data["pessoa_nome"] == "Ana"


def test_importador_com_ids_da_marketup(tmp_path):
    from django.core.management import call_command

    arquivo = tmp_path / "f.json"
    arquivo.write_text(json.dumps([
        {"id": 3, "t": 1, "pf": 0, "n": "Equipesca Equipamentos de Pesca LTDA", "a": "Equipesca", "cnpj": "00959857000133", "ie": "244013234110",
         "tel": "(19) 3708-9000", "end": [{"cep": "13080-290", "l": "Rua Henrique Veiga", "nu": "41", "ci": "Campinas", "uf": "SP", "ib": 3509502, "at": True}]},
        {"id": 3219, "t": 2, "pf": 1, "n": "adis", "bl": True, "tr": True, "end": []},
    ]), encoding="utf-8")
    call_command("importar_fornecedores", str(arquivo))
    e = Fornecedor.objects.get(pk=3)
    assert (e.tipo_pessoa, e.cnpj, e.telefone, e.indicador_ie) == ("J", "00959857000133", "1937089000", None)
    end = e.enderecos.get()
    assert (end.cep, end.ibge, end.padrao) == ("13080290", "3509502", True)
    a = Fornecedor.objects.get(pk=3219)
    assert (a.nome, a.tipo_id, a.bloqueado, a.transportadora) == ("Adis", 2, True, True)
    # A sequência segue depois do maior ID.
    assert Fornecedor.objects.create(nome="Novo").id > 3219
