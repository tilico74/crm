from django.db import transaction
from rest_framework import serializers

from apps.core.documentos import CepField, CnpjField, CpfField, RgField, TelefoneField

from .models import (
    Cliente,
    ContatoCliente,
    DadoBancarioCliente,
    DocumentoCliente,
    EnderecoCliente,
    HistoricoCliente,
    ItemListaPreco,
    ListaPreco,
    TipoDocumento,
)


class ItemListaPrecoSerializer(serializers.ModelSerializer):
    item_descricao = serializers.SerializerMethodField()

    class Meta:
        model = ItemListaPreco
        fields = [
            "produto", "servico", "item_descricao",
            "desconto_varejo", "desconto_varejo_tipo", "desconto_atacado", "desconto_atacado_tipo",
        ]

    def get_item_descricao(self, item):
        return item.produto.descricao if item.produto_id else item.servico.nome

    def validate(self, attrs):
        if bool(attrs.get("produto")) == bool(attrs.get("servico")):
            raise serializers.ValidationError("Escolha um produto ou um serviço para o desconto diferenciado.")
        return attrs


class ListaPrecoSerializer(serializers.ModelSerializer):
    itens = ItemListaPrecoSerializer(many=True, required=False)

    class Meta:
        model = ListaPreco
        fields = [
            "id", "nome", "desconto_varejo", "desconto_varejo_tipo", "desconto_atacado", "desconto_atacado_tipo",
            "itens", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        for campo in ("desconto_varejo", "desconto_atacado"):
            valor, tipo = attrs.get(campo), attrs.get(f"{campo}_tipo")
            if valor is not None and valor < 0:
                raise serializers.ValidationError({campo: "O desconto não pode ser negativo."})
            if tipo == "P" and valor is not None and valor > 100:
                raise serializers.ValidationError({campo: "Desconto em % vai de 0 a 100."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        itens = validated_data.pop("itens", [])
        lista = super().create(validated_data)
        self._gravar_itens(lista, itens)
        return lista

    @transaction.atomic
    def update(self, instance, validated_data):
        itens = validated_data.pop("itens", None)
        lista = super().update(instance, validated_data)
        if itens is not None:
            self._gravar_itens(lista, itens)
        return lista

    def _gravar_itens(self, lista, linhas):
        lista.itens.all().delete()
        ItemListaPreco.objects.bulk_create(ItemListaPreco(lista=lista, **linha) for linha in linhas)


class TipoDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoDocumento
        fields = ["id", "nome"]


# ---- Abas da ficha do cliente: linhas com id opcional (sem id = nova; com id = a existente) ----


class EnderecoClienteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    cep = CepField()

    class Meta:
        model = EnderecoCliente
        fields = ["id", "cep", "exterior", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "ibge", "ativo", "padrao"]


class ContatoClienteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    telefone = TelefoneField()

    class Meta:
        model = ContatoCliente
        fields = ["id", "nome", "cargo", "telefone", "email"]


class DadoBancarioClienteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    banco_nome = serializers.CharField(source="banco.__str__", read_only=True)

    class Meta:
        model = DadoBancarioCliente
        fields = ["id", "banco", "banco_nome", "agencia", "agencia_digito", "conta", "conta_digito"]


class DocumentoClienteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)
    arquivo = serializers.FileField(read_only=True)

    class Meta:
        model = DocumentoCliente
        fields = ["id", "tipo", "tipo_nome", "documento", "arquivo"]


class HistoricoClienteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = HistoricoCliente
        fields = ["id", "data", "descricao", "status"]


ABAS = {
    "enderecos": EnderecoCliente,
    "contatos": ContatoCliente,
    "dados_bancarios": DadoBancarioCliente,
    "documentos": DocumentoCliente,
    "historico": HistoricoCliente,
}


class ClienteListaSerializer(serializers.ModelSerializer):
    """Colunas da listagem da MarketUP: Nome, Tipo, Telefone, Celular, Email."""

    lista_preco_nome = serializers.CharField(source="lista_preco.nome", read_only=True)

    class Meta:
        model = Cliente
        fields = ["id", "nome", "apelido", "tipo_pessoa", "lista_preco", "lista_preco_nome", "telefone", "celular", "email", "cpf", "cnpj", "bloqueado"]


class ClienteSerializer(serializers.ModelSerializer):
    cpf = CpfField()
    rg = RgField()
    cnpj = CnpjField()
    telefone = TelefoneField()
    celular = TelefoneField()
    lista_preco_nome = serializers.CharField(source="lista_preco.nome", read_only=True)

    enderecos = EnderecoClienteSerializer(many=True, required=False)
    contatos = ContatoClienteSerializer(many=True, required=False)
    dados_bancarios = DadoBancarioClienteSerializer(many=True, required=False)
    documentos = DocumentoClienteSerializer(many=True, required=False)
    historico = HistoricoClienteSerializer(many=True, required=False)
    credito = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            "id", "tipo_pessoa", "lista_preco", "lista_preco_nome", "bloqueado",
            "nome", "apelido", "cpf", "rg", "rg_emissor", "rg_uf", "sexo", "aniversario",
            "cnpj", "indicador_ie", "inscricao_estadual", "inscricao_municipal",
            "telefone", "celular", "email", "site", "observacao", "limite_credito",
            "email_nfe", "iss_retido", "consumidor_final", "produtor_rural",
            "enderecos", "contatos", "dados_bancarios", "documentos", "historico", "credito",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def get_credito(self, cliente):
        # Aba Crédito. "Utilizado" = saldo das contas a receber em aberto do cliente (pedidos concluídos).
        from django.db.models import Sum

        from apps.financeiro.models import ContaReceber

        utilizado = ContaReceber.objects.filter(cliente=cliente, cancelada=False, saldo__gt=0).aggregate(s=Sum("saldo"))["s"] or 0
        return {"limite": cliente.limite_credito, "utilizado": utilizado, "disponivel": cliente.limite_credito - utilizado}

    def validate(self, attrs):
        tipo = attrs.get("tipo_pessoa", getattr(self.instance, "tipo_pessoa", Cliente.TipoPessoa.FISICA))
        # Só vale o documento do tipo escolhido (a tela esconde os do outro tipo).
        if self.partial and "tipo_pessoa" not in attrs:
            pass
        elif tipo == Cliente.TipoPessoa.JURIDICA:
            attrs.update(cpf="", rg="", rg_emissor="", rg_uf="", sexo="", aniversario=None)
        else:
            # Na MarketUP a pessoa física não mostra CNPJ, indicador da IE, IE nem IM.
            attrs.update(cnpj="", inscricao_estadual="", inscricao_municipal="", indicador_ie=Cliente.IndicadorIE.NAO_CONTRIBUINTE)
        cpf, cnpj = attrs.get("cpf"), attrs.get("cnpj")
        for campo, valor in (("cpf", cpf), ("cnpj", cnpj)):
            if valor:
                outros = Cliente.objects.filter(**{campo: valor})
                if self.instance:
                    outros = outros.exclude(pk=self.instance.pk)
                if outros.exists():
                    raise serializers.ValidationError({campo: f"Já existe o cliente {outros.first().nome} com este {campo.upper()}."})
        if attrs.get("indicador_ie") == Cliente.IndicadorIE.CONTRIBUINTE and not attrs.get(
            "inscricao_estadual", getattr(self.instance, "inscricao_estadual", "")
        ):
            raise serializers.ValidationError({"inscricao_estadual": "Contribuinte do ICMS precisa da Inscrição Estadual."})
        if attrs.get("limite_credito") is not None and attrs["limite_credito"] < 0:
            raise serializers.ValidationError({"limite_credito": "O limite de crédito não pode ser negativo."})
        enderecos = attrs.get("enderecos")
        if enderecos and sum(1 for e in enderecos if e.get("padrao")) > 1:
            raise serializers.ValidationError({"enderecos": "Marque só um endereço como padrão."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Cliente novo sem limite informado: "Limite para novos clientes" dos Parâmetros de venda
        # (a MarketUP faz igual no cadastro rápido do orçamento: config.ClientCreditLimit).
        if "limite_credito" not in self.initial_data:
            from apps.vendas.models import ParametrosVenda

            validated_data["limite_credito"] = ParametrosVenda.atual().limite_credito_novos
        abas = {nome: validated_data.pop(nome, None) for nome in ABAS}
        cliente = super().create(validated_data)
        self._gravar_abas(cliente, abas)
        return cliente

    @transaction.atomic
    def update(self, instance, validated_data):
        abas = {nome: validated_data.pop(nome, None) for nome in ABAS}
        cliente = super().update(instance, validated_data)
        self._gravar_abas(cliente, abas)
        return cliente

    def _gravar_abas(self, cliente, abas):
        """Atualiza pelo id, cria as novas e apaga as que saíram — os IDs não mudam (pedidos apontam para endereços)."""
        for nome, linhas in abas.items():
            if linhas is None:
                continue
            existentes = {obj.id: obj for obj in getattr(cliente, nome).all()}
            mantidos = set()
            for linha in linhas:
                linha = dict(linha)
                obj = existentes.get(linha.pop("id", None))
                if obj:
                    for campo, valor in linha.items():
                        setattr(obj, campo, valor)
                    obj.save()
                else:
                    obj = ABAS[nome].objects.create(cliente=cliente, **linha)
                mantidos.add(obj.id)
            for obj_id, obj in existentes.items():
                if obj_id not in mantidos:
                    if nome == "documentos" and obj.arquivo:
                        obj.arquivo.delete(save=False)
                    obj.delete()
        # Um endereço padrão: se nenhum ativo foi marcado, o primeiro ativo vira o padrão.
        enderecos = list(cliente.enderecos.all())
        if enderecos and not any(e.padrao for e in enderecos):
            primeiro = next((e for e in enderecos if e.ativo), enderecos[0])
            primeiro.padrao = True
            primeiro.save(update_fields=["padrao"])
