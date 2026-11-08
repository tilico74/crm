import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.catalogo.models import Produto, Unidade
from apps.clientes.models import Cliente, ListaPreco, TipoDocumento
from apps.financeiro.models import Banco
from apps.usuarios.models import Funcionalidade, Grupo, PermissaoGrupo, Usuario

pytestmark = pytest.mark.django_db

CPF = "52998224725"
CNPJ = "11222333000181"


@pytest.fixture
def admin():
    usuario = Usuario.objects.create_user("chefe", password="x", grupo=Grupo.objects.get(nome="Administrador"))
    api = APIClient()
    api.force_authenticate(usuario)
    return api, usuario


def ficha(**extra):
    return {"tipo_pessoa": "F", "nome": "joão da silva", "cpf": "529.982.247-25", "telefone": "(48) 3333-4444", **extra}


def test_dados_iniciais_com_ids_da_marketup():
    assert ListaPreco.objects.get(pk=1).nome == "Padrão"
    assert set(TipoDocumento.objects.values_list("id", flat=True)) == {6, 11, 12, 13, 14}


def test_sem_login_401_e_sem_permissao_403():
    assert APIClient().get("/api/clientes").status_code == 401
    grupo = Grupo.objects.create(nome="Sem clientes")
    usuario = Usuario.objects.create_user("x", password="x", grupo=grupo)
    api = APIClient()
    api.force_authenticate(usuario)
    assert api.get("/api/clientes").status_code == 403
    PermissaoGrupo.objects.create(grupo=grupo, funcionalidade=Funcionalidade.objects.get(codigo="clientes"), acessar=True)
    assert api.get("/api/clientes").status_code == 200
    assert api.post("/api/clientes", ficha(), format="json").status_code == 403
    # Quem acessa clientes lê as listas de preços (select "Tipo").
    assert api.get("/api/listas-precos").status_code == 200


def test_cria_pessoa_fisica_limpa_documentos_e_padroniza_nome(admin):
    api, usuario = admin
    resposta = api.post("/api/clientes", ficha(cnpj=CNPJ), format="json")
    assert resposta.status_code == 201, resposta.data
    cliente = Cliente.objects.get(pk=resposta.data["id"])
    assert cliente.nome == "João da Silva"
    assert cliente.cpf == CPF and cliente.telefone == "4833334444"
    assert cliente.cnpj == ""  # documento de pessoa jurídica não fica escondido na física
    assert cliente.lista_preco_id == 1 and cliente.criado_por == usuario


def test_pessoa_juridica_guarda_razao_social_como_digitada(admin):
    api, _ = admin
    dados = {"tipo_pessoa": "J", "nome": "REDES XYZ ltda", "apelido": "xyz redes", "cnpj": "11.222.333/0001-81", "cpf": CPF}
    resposta = api.post("/api/clientes", dados, format="json")
    assert resposta.status_code == 201, resposta.data
    assert resposta.data["nome"] == "REDES XYZ ltda" and resposta.data["apelido"] == "xyz redes"
    assert resposta.data["cnpj"] == CNPJ and resposta.data["cpf"] == ""


def test_valida_cpf_duplicidade_e_ie(admin):
    api, _ = admin
    assert "cpf" in api.post("/api/clientes", ficha(cpf="111.111.111-12"), format="json").data
    assert api.post("/api/clientes", ficha(), format="json").status_code == 201
    duplicado = api.post("/api/clientes", ficha(nome="Outro"), format="json")
    assert duplicado.status_code == 400 and "Já existe" in str(duplicado.data["cpf"])
    sem_ie = api.post("/api/clientes", {"tipo_pessoa": "J", "nome": "Empresa", "indicador_ie": 1}, format="json")
    assert "inscricao_estadual" in sem_ie.data


def test_abas_gravam_sem_trocar_ids(admin):
    api, _ = admin
    banco = Banco.objects.create(codigo="001", nome="Banco do Brasil")
    dados = ficha(
        enderecos=[
            {"cep": "88101-370", "logradouro": "Rua A", "numero": "10", "bairro": "Kobrasol", "cidade": "São José", "uf": "sc"},
            {"cep": "88101-270", "logradouro": "Rua B", "numero": "20", "cidade": "São José", "uf": "SC"},
        ],
        contatos=[{"nome": "maria souza", "cargo": "Compras", "telefone": "48999998888"}],
        dados_bancarios=[{"banco": banco.id, "agencia": "1234", "agencia_digito": "5", "conta": "9876", "conta_digito": "0"}],
        documentos=[{"tipo": 13, "documento": "4329-3/01"}],
        historico=[{"data": "2026-11-08", "descricao": "Ligou pedindo orçamento", "status": 1}],
    )
    criado = api.post("/api/clientes", dados, format="json")
    assert criado.status_code == 201, criado.data
    c = criado.data
    assert c["enderecos"][0]["padrao"] is True and c["enderecos"][0]["uf"] == "SC" and c["enderecos"][0]["cep"] == "88101370"
    assert c["contatos"][0]["nome"] == "Maria Souza"
    assert c["documentos"][0]["tipo_nome"] == "CNAE"
    assert c["credito"]["disponivel"] == c["credito"]["limite"]

    primeiro = c["enderecos"][0]
    atualizado = api.put(
        f"/api/clientes/{c['id']}",
        {**ficha(), "enderecos": [{**primeiro, "numero": "11"}], "contatos": [], "historico": c["historico"]},
        format="json",
    )
    assert atualizado.status_code == 200, atualizado.data
    assert [(e["id"], e["numero"]) for e in atualizado.data["enderecos"]] == [(primeiro["id"], "11")]
    assert atualizado.data["contatos"] == []
    assert len(atualizado.data["documentos"]) == 1  # aba não enviada fica como está


def test_um_so_endereco_padrao(admin):
    api, _ = admin
    dados = ficha(enderecos=[{"logradouro": "A", "padrao": True}, {"logradouro": "B", "padrao": True}])
    assert "enderecos" in api.post("/api/clientes", dados, format="json").data


def test_anexo_de_documento(admin, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    api, _ = admin
    c = api.post("/api/clientes", ficha(documentos=[{"tipo": 6, "documento": "123456"}]), format="json").data
    doc = c["documentos"][0]["id"]
    pdf = SimpleUploadedFile("ie.pdf", b"%PDF-1.4", content_type="application/pdf")
    resposta = api.post(f"/api/clientes/{c['id']}/documentos/{doc}/arquivo", {"arquivo": pdf}, format="multipart")
    assert resposta.status_code == 200 and "clientes/documentos/" in resposta.data["arquivo"]
    txt = SimpleUploadedFile("x.txt", b"oi", content_type="text/plain")
    assert api.post(f"/api/clientes/{c['id']}/documentos/{doc}/arquivo", {"arquivo": txt}, format="multipart").status_code == 400
    assert api.delete(f"/api/clientes/{c['id']}/documentos/{doc}/arquivo").data["arquivo"] is None


def test_filtros_da_listagem(admin):
    api, _ = admin
    api.post("/api/clientes", ficha(email="joao@x.com"), format="json")
    api.post("/api/clientes", {"tipo_pessoa": "J", "nome": "Empresa", "cnpj": CNPJ, "bloqueado": True}, format="json")
    assert api.get("/api/clientes?cpf=529.982").data["count"] == 1
    assert api.get("/api/clientes?cnpj=11.222.333").data["results"][0]["nome"] == "Empresa"
    assert api.get("/api/clientes?bloqueado=true").data["count"] == 1
    assert api.get("/api/clientes?telefone=3333-4444").data["count"] == 1
    assert api.get("/api/clientes?search=joao@x").data["count"] == 1
    linha = api.get("/api/clientes?email=joao").data["results"][0]
    assert linha["lista_preco_nome"] == "Padrão" and "enderecos" not in linha


def test_lista_de_precos_com_itens_e_padrao_protegida(admin):
    api, _ = admin
    unidade = Unidade.objects.get(pk=1)
    produto = Produto.objects.create(descricao="Rede de proteção", unidade=unidade)
    dados = {
        "nome": "Revenda", "desconto_varejo": "10", "desconto_varejo_tipo": "P",
        "itens": [{"produto": produto.id, "desconto_varejo": "5.00", "desconto_varejo_tipo": "R"}],
    }
    criada = api.post("/api/listas-precos", dados, format="json")
    assert criada.status_code == 201, criada.data
    assert criada.data["id"] > 1 and criada.data["itens"][0]["item_descricao"] == "Rede de proteção"
    assert "desconto_varejo" in api.post("/api/listas-precos", {"nome": "X", "desconto_varejo": "150", "desconto_varejo_tipo": "P"}, format="json").data
    assert api.delete("/api/listas-precos/1").status_code == 400
    api.post("/api/clientes", ficha(lista_preco=criada.data["id"]), format="json")
    assert api.delete(f"/api/listas-precos/{criada.data['id']}").status_code == 400
