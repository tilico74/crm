from django.db import transaction
from rest_framework import serializers

from .models import Categoria, ComposicaoProduto, Marca, Produto, Servico, Subcategoria, Unidade


class UnidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidade
        fields = ["id", "sigla", "nome", "sistema"]
        read_only_fields = ["sistema"]

    def validate_sigla(self, valor):
        return valor.strip().upper()


class MarcaSerializer(serializers.ModelSerializer):
    imagem = serializers.FileField(read_only=True)

    class Meta:
        model = Marca
        fields = ["id", "nome", "imagem"]


class SubcategoriaSerializer(serializers.ModelSerializer):
    # Opcional: sem id = subcategoria nova; com id = a existente (o ID não muda, produtos apontam para ele).
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Subcategoria
        fields = ["id", "nome", "categoria"]
        read_only_fields = ["categoria"]


class CategoriaSerializer(serializers.ModelSerializer):
    subcategorias = SubcategoriaSerializer(many=True, required=False)

    class Meta:
        model = Categoria
        fields = ["id", "nome", "subcategorias"]

    @transaction.atomic
    def create(self, validated_data):
        subcategorias = validated_data.pop("subcategorias", [])
        categoria = super().create(validated_data)
        self._gravar_subcategorias(categoria, subcategorias)
        return categoria

    @transaction.atomic
    def update(self, instance, validated_data):
        subcategorias = validated_data.pop("subcategorias", None)
        categoria = super().update(instance, validated_data)
        if subcategorias is not None:
            self._gravar_subcategorias(categoria, subcategorias)
        return categoria

    def _gravar_subcategorias(self, categoria, linhas):
        """Atualiza pelo id, cria as novas e apaga as que saíram da lista — sem trocar IDs."""
        usuario = self.context["request"].user
        existentes = {s.id: s for s in categoria.subcategorias.all()}
        mantidos = set()
        for linha in linhas:
            sub = existentes.get(linha.get("id"))
            if sub:
                sub.nome = linha["nome"]
                sub.atualizado_por = usuario
                sub.save()
            else:
                sub = Subcategoria.objects.create(categoria=categoria, nome=linha["nome"], criado_por=usuario, atualizado_por=usuario)
            mantidos.add(sub.id)
        for sub_id, sub in existentes.items():
            if sub_id not in mantidos:
                sub.delete()


class ComposicaoSerializer(serializers.ModelSerializer):
    item_descricao = serializers.CharField(source="item.descricao", read_only=True)
    item_custo = serializers.DecimalField(source="item.preco_custo", max_digits=12, decimal_places=2, read_only=True)
    unidade_sigla = serializers.CharField(source="unidade.sigla", default=None, read_only=True)

    class Meta:
        model = ComposicaoProduto
        fields = ["item", "item_descricao", "item_custo", "quantidade", "unidade", "unidade_sigla"]


class ProdutoSerializer(serializers.ModelSerializer):
    unidade_sigla = serializers.CharField(source="unidade.sigla", read_only=True)
    categoria_nome = serializers.CharField(source="categoria.nome", default=None, read_only=True)
    subcategoria_nome = serializers.CharField(source="subcategoria.nome", default=None, read_only=True)
    marca_nome = serializers.CharField(source="marca.nome", default=None, read_only=True)
    fragmentacao_unidade_sigla = serializers.CharField(source="fragmentacao_unidade.sigla", default=None, read_only=True)
    imagem = serializers.FileField(read_only=True)
    composicao = ComposicaoSerializer(many=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    # NCM e CEST chegam com ou sem pontos; a pontuação sai antes de validar (validate_ncm / validate_cest).
    ncm = serializers.CharField(max_length=20, allow_blank=True, required=False)
    cest = serializers.CharField(max_length=20, allow_blank=True, required=False)

    class Meta:
        model = Produto
        fields = [
            "id", "ativo", "codigo_barras", "imagem", "descricao", "tipo_item", "unidade", "unidade_sigla",
            "codigo_balanca", "categoria", "categoria_nome", "subcategoria", "subcategoria_nome", "marca", "marca_nome",
            "modelo", "codigo_interno", "tags",
            "preco_custo", "preco_venda", "preco_atacado", "quantidade_minima_atacado", "reajustar_pela_margem",
            "movimenta_estoque", "movimenta_estoque_composicao",
            "fragmentacao_quantidade", "fragmentacao_unidade", "fragmentacao_unidade_sigla", "fragmentacao_preco",
            "tipo_fiscal", "ncm", "origem", "cest", "classificacao",
            "composicao", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        categoria = attrs.get("categoria", getattr(self.instance, "categoria", None))
        subcategoria = attrs.get("subcategoria", getattr(self.instance, "subcategoria", None))
        if subcategoria and subcategoria.categoria_id != getattr(categoria, "id", None):
            raise serializers.ValidationError({"subcategoria": "A subcategoria não é da categoria escolhida."})
        for linha in attrs.get("composicao", []):
            if self.instance and linha["item"].id == self.instance.id:
                raise serializers.ValidationError({"composicao": "Um kit não pode conter ele mesmo."})
        self._validar_fragmentacao(attrs)
        return attrs

    def _validar_fragmentacao(self, attrs):
        """Fragmentação é tudo ou nada: quantidade maior que 1 parte, unidade e valor de venda juntos."""
        campos = ("fragmentacao_quantidade", "fragmentacao_unidade", "fragmentacao_preco")
        valores = {c: attrs.get(c, getattr(self.instance, c, None)) for c in campos}
        if not any(valores.values()):
            return
        erros = {}
        if not valores["fragmentacao_quantidade"] or valores["fragmentacao_quantidade"] <= 0:
            erros["fragmentacao_quantidade"] = "Informe em quantas partes 1 unidade do produto se divide."
        if not valores["fragmentacao_unidade"]:
            erros["fragmentacao_unidade"] = "Escolha a unidade da parte vendida (ex.: Metro)."
        if valores["fragmentacao_preco"] is None:
            erros["fragmentacao_preco"] = "Informe o valor de venda de cada parte."
        if erros:
            raise serializers.ValidationError(erros)

    def validate_ncm(self, valor):
        ncm = "".join(c for c in valor if c.isdigit())
        if ncm and len(ncm) != 8:
            raise serializers.ValidationError("NCM inválido. Confira os 8 dígitos (ex.: 5608.19.00).")
        return ncm

    def validate_cest(self, valor):
        cest = "".join(c for c in valor if c.isdigit())
        if cest and len(cest) != 7:
            raise serializers.ValidationError("CEST inválido. Confira os 7 dígitos (ex.: 01.020.00).")
        return cest

    def validate_tags(self, tags):
        # Sem repetição e sem espaços sobrando, na ordem digitada.
        return list(dict.fromkeys(t.strip() for t in tags if t.strip()))

    @transaction.atomic
    def create(self, validated_data):
        composicao = validated_data.pop("composicao", [])
        produto = super().create(validated_data)
        self._gravar_composicao(produto, composicao)
        return produto

    @transaction.atomic
    def update(self, instance, validated_data):
        composicao = validated_data.pop("composicao", None)
        produto = super().update(instance, validated_data)
        if composicao is not None:
            self._gravar_composicao(produto, composicao)
        return produto

    def _gravar_composicao(self, produto, linhas):
        produto.composicao.all().delete()
        ComposicaoProduto.objects.bulk_create(ComposicaoProduto(kit=produto, **linha) for linha in linhas)


class ServicoSerializer(serializers.ModelSerializer):
    unidade_sigla = serializers.CharField(source="unidade.sigla", read_only=True)

    class Meta:
        model = Servico
        fields = [
            "id", "ativo", "codigo_barras", "nome", "preco_custo", "preco_venda", "unidade", "unidade_sigla",
            "reajustar_pela_margem", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
