from django.core.validators import RegexValidator
from django.db import models

from apps.core.models import ModeloBase

# Catálogo › tabelas auxiliares, com os IDs da MarketUP (UnitID, BrandID, CategoryID,
# SubcategoryID). Campos e telas: context/marketup/telas-e-entidades.md (Catálogo).


class Unidade(ModeloBase):
    sigla = models.CharField("sigla", max_length=10, unique=True)
    nome = models.CharField("nome", max_length=60)
    # Unidades padrão da MarketUP (UN, CX, FD, KG, HF): não editam nem excluem.
    sistema = models.BooleanField("do sistema", default=False)

    class Meta:
        db_table = "unidade"
        ordering = ["nome"]
        verbose_name = "unidade de medida"
        verbose_name_plural = "unidades de medida"

    def __str__(self):
        return f"{self.sigla} - {self.nome}"


class Marca(ModeloBase):
    nome = models.CharField("nome", max_length=80)
    imagem = models.FileField("imagem", upload_to="marcas/", blank=True)

    class Meta:
        db_table = "marca"
        ordering = ["nome"]
        verbose_name = "marca"
        verbose_name_plural = "marcas"

    def __str__(self):
        return self.nome


class Categoria(ModeloBase):
    nome = models.CharField("nome", max_length=80)

    class Meta:
        db_table = "categoria"
        ordering = ["nome"]
        verbose_name = "categoria"
        verbose_name_plural = "categorias"

    def __str__(self):
        return self.nome


class Subcategoria(ModeloBase):
    categoria = models.ForeignKey(Categoria, verbose_name="categoria", on_delete=models.PROTECT, related_name="subcategorias")
    nome = models.CharField("nome", max_length=80)

    class Meta:
        db_table = "subcategoria"
        ordering = ["nome"]
        verbose_name = "subcategoria"
        verbose_name_plural = "subcategorias"

    def __str__(self):
        return f"{self.categoria} › {self.nome}"


class Produto(ModeloBase):
    """Produto da MarketUP (ID = ItemID). A descrição é gravada como veio, sem padronizar (T103)."""

    class TipoItem(models.TextChoices):
        PRODUTO = "produto", "Produto"
        KIT = "kit", "Kit"
        INSUMO = "insumo", "Insumo"
        BRINDE = "brinde", "Brinde"

    class TipoFiscal(models.TextChoices):
        ATIVO_IMOBILIZADO = "ativo_imobilizado", "Ativo imobilizado"
        EMBALAGEM = "embalagem", "Embalagem"
        USO_CONSUMO = "uso_consumo", "Material de uso e consumo"
        MATERIA_PRIMA = "materia_prima", "Matéria-prima"
        REVENDA = "revenda", "Mercadoria para revenda"
        OUTRAS = "outras", "Outras"
        OUTROS_INSUMOS = "outros_insumos", "Outros insumos"
        ACABADO = "acabado", "Produto acabado"
        EM_PROCESSO = "em_processo", "Produto em processo"
        INTERMEDIARIO = "intermediario", "Produto intermediário"
        SERVICOS = "servicos", "Serviços"
        SUBPRODUTO = "subproduto", "Subproduto"

    class Origem(models.IntegerChoices):
        # Tabela oficial da NF-e (mesmos textos da MarketUP).
        NACIONAL = 0, "0 - Nacional, exceto as indicadas nos códigos 3 a 5"
        ESTRANGEIRA_DIRETA = 1, "1 - Estrangeira – Importação direta, exceto a indicada no código 6"
        ESTRANGEIRA_INTERNO = 2, "2 - Estrangeira – Adquirida no mercado interno, exceto a indicada no código 7"
        NACIONAL_IMPORTACAO_40 = 3, "3 - Nacional, mercadoria ou bem com conteúdo de importação superior a 40%"
        NACIONAL_PPB = 4, "4 - Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos"
        NACIONAL_IMPORTACAO_ATE_40 = 5, "5 - Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%"
        ESTRANGEIRA_DIRETA_CAMEX = 6, "6 - Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CAMEX"
        ESTRANGEIRA_INTERNO_CAMEX = 7, "7 - Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX"
        NACIONAL_IMPORTACAO_70 = 8, "8 - Nacional, Conteúdo de Importação superior a 70%"

    class Classificacao(models.TextChoices):
        COMUM = "comum", "Comum"
        MEDICAMENTOS = "medicamentos", "Medicamentos"
        ARMAMENTOS = "armamentos", "Armamentos"
        COMBUSTIVEIS = "combustiveis", "Combustíveis"
        VEICULOS_NOVOS = "veiculos_novos", "Veículos novos"

    # Cabeçalho
    ativo = models.BooleanField("ativo", default=True)
    codigo_barras = models.CharField("código de barras", max_length=20, blank=True)
    imagem = models.FileField("foto", upload_to="produtos/", blank=True)
    descricao = models.CharField("descrição", max_length=200)
    tipo_item = models.CharField("tipo de item", max_length=10, choices=TipoItem, default=TipoItem.PRODUTO)
    unidade = models.ForeignKey(Unidade, verbose_name="unidade", on_delete=models.PROTECT, related_name="+")
    codigo_balanca = models.CharField("código de balança", max_length=20, blank=True)
    categoria = models.ForeignKey(Categoria, verbose_name="categoria", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos")
    subcategoria = models.ForeignKey(
        Subcategoria, verbose_name="subcategoria", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos"
    )
    marca = models.ForeignKey(Marca, verbose_name="marca", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos")
    modelo = models.CharField("modelo", max_length=80, blank=True)
    codigo_interno = models.CharField("código interno", max_length=40, blank=True)
    tags = models.JSONField("tags", default=list, blank=True)
    # Preços
    preco_custo = models.DecimalField("custo (última compra)", max_digits=12, decimal_places=2, default=0)
    preco_venda = models.DecimalField("venda varejo", max_digits=12, decimal_places=2, default=0)
    preco_atacado = models.DecimalField("venda atacado", max_digits=12, decimal_places=2, default=0)
    quantidade_minima_atacado = models.DecimalField("qtde mínima p/ atacado", max_digits=12, decimal_places=3, default=0)
    reajustar_pela_margem = models.BooleanField("reajustar preço de venda pela margem de lucro", default=False)
    # Estoque
    movimenta_estoque = models.BooleanField("movimentar estoque", default=False)
    movimenta_estoque_composicao = models.BooleanField("movimentar estoque da composição", default=False)
    # Fragmentação (venda fracionada): "1 <unidade do produto> = <quantidade> <unidade>", vendida por <preço>.
    # Ex.: 1 Rolo = 50 Metros, a R$ 12,00 o metro. Vazia = o produto não é vendido fracionado.
    fragmentacao_quantidade = models.DecimalField("fragmentação: quantidade", max_digits=12, decimal_places=3, null=True, blank=True)
    fragmentacao_unidade = models.ForeignKey(
        Unidade, verbose_name="fragmentação: unidade", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    fragmentacao_preco = models.DecimalField("fragmentação: valor de venda", max_digits=12, decimal_places=2, null=True, blank=True)
    # Fiscal
    tipo_fiscal = models.CharField("tipo (fiscal)", max_length=20, choices=TipoFiscal, blank=True)
    ncm = models.CharField("NCM", max_length=8, blank=True, validators=[RegexValidator(r"^\d{8}$", "NCM tem 8 dígitos.")])
    origem = models.PositiveSmallIntegerField("origem", choices=Origem, null=True, blank=True)
    cest = models.CharField("CEST", max_length=7, blank=True, validators=[RegexValidator(r"^\d{7}$", "CEST tem 7 dígitos.")])
    classificacao = models.CharField("classificação", max_length=20, choices=Classificacao, default=Classificacao.COMUM)

    class Meta:
        db_table = "produto"
        ordering = ["descricao"]
        constraints = [
            # Código de barras não se repete (vazio pode repetir).
            models.UniqueConstraint(fields=["codigo_barras"], condition=~models.Q(codigo_barras=""), name="produto_codigo_barras_unico"),
        ]
        verbose_name = "produto"
        verbose_name_plural = "produtos"

    def __str__(self):
        return self.descricao


class ComposicaoProduto(models.Model):
    """Itens de um kit (aba Composição da MarketUP)."""

    kit = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="composicao")
    item = models.ForeignKey(Produto, verbose_name="item", on_delete=models.PROTECT, related_name="+")
    quantidade = models.DecimalField("quantidade", max_digits=12, decimal_places=3)
    unidade = models.ForeignKey(Unidade, verbose_name="unidade", on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "produto_composicao"
        verbose_name = "item da composição"
        verbose_name_plural = "composição"


class Servico(ModeloBase):
    """Serviço da MarketUP (ID = ServiceID; sequência própria, separada da de produtos)."""

    ativo = models.BooleanField("serviço ativo?", default=True)
    codigo_barras = models.CharField("código de barras", max_length=20, blank=True)
    nome = models.CharField("nome do serviço", max_length=200)
    preco_custo = models.DecimalField("custo", max_digits=12, decimal_places=2, default=0)
    preco_venda = models.DecimalField("valor", max_digits=12, decimal_places=2, default=0)
    unidade = models.ForeignKey(Unidade, verbose_name="unidade", on_delete=models.PROTECT, related_name="+")
    reajustar_pela_margem = models.BooleanField("reajustar valor pela margem de lucro", default=False)

    class Meta:
        db_table = "servico"
        ordering = ["nome"]
        verbose_name = "serviço"
        verbose_name_plural = "serviços"

    def __str__(self):
        return self.nome
