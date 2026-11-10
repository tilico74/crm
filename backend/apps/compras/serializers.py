from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.core.documentos import CepField, CnpjField, CpfField, RgField, TelefoneField

from .models import (
    ChavePixFornecedor,
    ContatoFornecedor,
    DadoBancarioFornecedor,
    DocumentoFornecedor,
    EnderecoFornecedor,
    Fornecedor,
    TipoFornecedor,
)


class TipoFornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoFornecedor
        fields = ["id", "nome"]


# ---- Abas da ficha: linhas com id opcional (sem id = nova; com id = a existente) ----


class EnderecoFornecedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    cep = CepField()

    class Meta:
        model = EnderecoFornecedor
        fields = ["id", "cep", "exterior", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "ibge", "ativo", "padrao"]


class ContatoFornecedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    telefone = TelefoneField()

    class Meta:
        model = ContatoFornecedor
        fields = ["id", "nome", "cargo", "telefone", "email"]


class DadoBancarioFornecedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    banco_nome = serializers.CharField(source="banco.__str__", read_only=True)

    class Meta:
        model = DadoBancarioFornecedor
        fields = ["id", "banco", "banco_nome", "agencia", "agencia_digito", "conta", "conta_digito"]


class ChavePixFornecedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_nome = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = ChavePixFornecedor
        fields = ["id", "tipo", "tipo_nome", "chave"]

    def validate_chave(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Informe a chave Pix.")
        return valor


class DocumentoFornecedorSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)
    arquivo = serializers.FileField(read_only=True)

    class Meta:
        model = DocumentoFornecedor
        fields = ["id", "tipo", "tipo_nome", "documento", "arquivo"]


ABAS = {
    "enderecos": EnderecoFornecedor,
    "contatos": ContatoFornecedor,
    "dados_bancarios": DadoBancarioFornecedor,
    "chaves_pix": ChavePixFornecedor,
    "documentos": DocumentoFornecedor,
}


class FornecedorListaSerializer(serializers.ModelSerializer):
    """Colunas da listagem da MarketUP: Nome, Tipo, Telefone, Celular, Email."""

    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)

    class Meta:
        model = Fornecedor
        fields = ["id", "nome", "apelido", "tipo_pessoa", "tipo", "tipo_nome", "telefone", "celular", "email", "cpf", "cnpj",
                  "inscricao_estadual", "bloqueado", "transportadora"]


class FornecedorSerializer(serializers.ModelSerializer):
    cpf = CpfField()
    rg = RgField()
    cnpj = CnpjField()
    telefone = TelefoneField()
    celular = TelefoneField()
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)

    enderecos = EnderecoFornecedorSerializer(many=True, required=False)
    contatos = ContatoFornecedorSerializer(many=True, required=False)
    dados_bancarios = DadoBancarioFornecedorSerializer(many=True, required=False)
    chaves_pix = ChavePixFornecedorSerializer(many=True, required=False)
    documentos = DocumentoFornecedorSerializer(many=True, required=False)
    financeiro = serializers.SerializerMethodField()

    class Meta:
        model = Fornecedor
        fields = [
            "id", "tipo_pessoa", "tipo", "tipo_nome", "bloqueado",
            "nome", "apelido", "cpf", "rg", "rg_emissor", "rg_uf", "sexo", "aniversario",
            "cnpj", "indicador_ie", "inscricao_estadual", "inscricao_municipal",
            "telefone", "celular", "email", "site", "email_nfe", "observacao", "transportadora", "produtor_rural",
            "enderecos", "contatos", "dados_bancarios", "chaves_pix", "documentos", "financeiro",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def get_financeiro(self, fornecedor):
        """
        Aba Financeiro (SupplierFinancialEventList da MarketUP): as contas a pagar do fornecedor.
        Vencidas = saldo e vencimento antes de hoje; A vencer = saldo e vencimento hoje ou depois; Pagas = sem saldo.
        """
        if not fornecedor.pk:
            return None
        from apps.financeiro.models import ContaPagar

        hoje = timezone.localdate()
        contas = ContaPagar.objects.filter(fornecedor=fornecedor, cancelada=False).order_by("vencimento", "id")
        linhas, totais = [], {"vencidas": 0, "a_vencer": 0, "pagas": 0}
        for c in contas:
            if c.saldo > 0:
                situacao = "vencida" if c.vencimento < hoje else "a_vencer"
                totais["vencidas" if situacao == "vencida" else "a_vencer"] += c.saldo
            else:
                situacao = "paga"
                totais["pagas"] += c.valor
            linhas.append({"id": c.id, "descricao": c.descricao, "vencimento": c.vencimento, "valor": c.valor, "saldo": c.saldo, "situacao": situacao})
        return {"totais": totais, "contas": linhas}

    def validate(self, attrs):
        tipo = attrs.get("tipo_pessoa", getattr(self.instance, "tipo_pessoa", Fornecedor.TipoPessoa.JURIDICA))
        if self.partial and "tipo_pessoa" not in attrs:
            pass
        elif tipo == Fornecedor.TipoPessoa.JURIDICA:
            # MarketUP: ao trocar o tipo de pessoa, "Os dados do tipo de pessoa antigo (CPF e RG ou CNPJ e IE) serão apagados".
            attrs.update(cpf="", rg="", rg_emissor="", rg_uf="", sexo="", aniversario=None)
        else:
            attrs.update(cnpj="", inscricao_estadual="", inscricao_municipal="", indicador_ie=None)
        for campo in ("cpf", "cnpj"):
            valor = attrs.get(campo)
            if valor:
                outros = Fornecedor.objects.filter(**{campo: valor})
                if self.instance:
                    outros = outros.exclude(pk=self.instance.pk)
                if outros.exists():
                    raise serializers.ValidationError({campo: f"Já existe o fornecedor {outros.first().nome} com este {campo.upper()}."})
        if attrs.get("indicador_ie") == Fornecedor.IndicadorIE.CONTRIBUINTE and not attrs.get(
            "inscricao_estadual", getattr(self.instance, "inscricao_estadual", "")
        ):
            raise serializers.ValidationError({"inscricao_estadual": "Contribuinte do ICMS precisa da Inscrição Estadual."})
        enderecos = attrs.get("enderecos")
        if enderecos and sum(1 for e in enderecos if e.get("padrao")) > 1:
            raise serializers.ValidationError({"enderecos": "Marque só um endereço como padrão."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        abas = {nome: validated_data.pop(nome, None) for nome in ABAS}
        fornecedor = super().create(validated_data)
        self._gravar_abas(fornecedor, abas)
        return fornecedor

    @transaction.atomic
    def update(self, instance, validated_data):
        abas = {nome: validated_data.pop(nome, None) for nome in ABAS}
        fornecedor = super().update(instance, validated_data)
        self._gravar_abas(fornecedor, abas)
        return fornecedor

    def _gravar_abas(self, fornecedor, abas):
        """Atualiza pelo id, cria as novas e apaga as que saíram — os IDs não mudam (pedidos de compra apontam para endereços)."""
        for nome, linhas in abas.items():
            if linhas is None:
                continue
            existentes = {obj.id: obj for obj in getattr(fornecedor, nome).all()}
            mantidos = set()
            for linha in linhas:
                linha = dict(linha)
                obj = existentes.get(linha.pop("id", None))
                if obj:
                    for campo, valor in linha.items():
                        setattr(obj, campo, valor)
                    obj.save()
                else:
                    obj = ABAS[nome].objects.create(fornecedor=fornecedor, **linha)
                mantidos.add(obj.id)
            for obj_id, obj in existentes.items():
                if obj_id not in mantidos:
                    if nome == "documentos" and obj.arquivo:
                        obj.arquivo.delete(save=False)
                    obj.delete()
        enderecos = list(fornecedor.enderecos.all())
        if enderecos and not any(e.padrao for e in enderecos):
            primeiro = next((e for e in enderecos if e.ativo), enderecos[0])
            primeiro.padrao = True
            primeiro.save(update_fields=["padrao"])
