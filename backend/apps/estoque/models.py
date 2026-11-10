"""
Estoque (T301), no modelo da MarketUP (stock_location, storage_type, stock_movement_reason, new_stock_movement,
stock_query e inventário). Regras em context/marketup/telas-e-entidades.md, seção "Estoque e Compras (T301)".
IDs iguais aos da MarketUP: tipo 1 Padrão, 2 Refrigerado; local 1 Estoque Padrão.
"""

from django.db import models

from apps.core.models import ModeloBase


class TipoEstocagem(ModeloBase):
    """Tipo de estocagem (StorageType)."""

    nome = models.CharField("nome", max_length=80)
    sistema = models.BooleanField("do sistema", default=False)

    class Meta:
        db_table = "tipo_estocagem"
        ordering = ["nome"]
        verbose_name = "tipo de estocagem"
        verbose_name_plural = "tipos de estocagem"

    def __str__(self):
        return self.nome


class LocalEstoque(ModeloBase):
    """Local de estoque (StockLocation). O local padrão recebe as entradas e saídas automáticas."""

    nome = models.CharField("nome", max_length=120)
    tipo = models.ForeignKey(TipoEstocagem, verbose_name="tipo de estocagem", on_delete=models.PROTECT, related_name="locais")
    ativo = models.BooleanField("ativo", default=True)
    padrao = models.BooleanField("padrão", default=False)
    sistema = models.BooleanField("do sistema", default=False)

    class Meta:
        db_table = "local_estoque"
        ordering = ["nome"]
        verbose_name = "local de estoque"
        verbose_name_plural = "locais de estoque"

    def __str__(self):
        return self.nome

    @classmethod
    def padrao_atual(cls) -> "LocalEstoque | None":
        return cls.objects.filter(padrao=True, ativo=True).first() or cls.objects.filter(pk=1).first()


class MotivoMovimentacao(ModeloBase):
    """Motivo da movimentação de saída (StockMovementReason)."""

    nome = models.CharField("nome", max_length=120)

    class Meta:
        db_table = "motivo_movimentacao"
        ordering = ["nome"]
        verbose_name = "motivo de movimentação"
        verbose_name_plural = "motivos de movimentação"

    def __str__(self):
        return self.nome


class Saldo(models.Model):
    """Quantidade de um produto num local (a Consulta de estoque soma os locais)."""

    produto = models.ForeignKey("catalogo.Produto", on_delete=models.CASCADE, related_name="saldos")
    local = models.ForeignKey(LocalEstoque, on_delete=models.PROTECT, related_name="saldos")
    quantidade = models.DecimalField("quantidade", max_digits=14, decimal_places=3, default=0)

    class Meta:
        db_table = "estoque_saldo"
        constraints = [models.UniqueConstraint(fields=["produto", "local"], name="saldo_produto_local_unico")]
        verbose_name = "saldo de estoque"
        verbose_name_plural = "saldos de estoque"


class Movimentacao(ModeloBase):
    """Movimentação de estoque (StockMovement): manual (entrada, saída, transferência) ou automática (documentos)."""

    class Tipo(models.IntegerChoices):  # StockMovementTypeEnum
        ENTRADA = 1, "Entrada"
        SAIDA = 2, "Saída"
        TRANSFERENCIA = 3, "Transferência"
        ACERTO = 4, "Acerto"

    class Origem(models.IntegerChoices):  # StockMovementOriginTypeEnum
        PEDIDO_VENDA = 1, "Pedido de venda"
        COMPRA = 4, "Pedido de compra"
        TRANSFERENCIA = 5, "Transferência"
        CANCELAMENTO_VENDA = 6, "Cancelamento de pedido de venda"
        DEVOLUCAO_VENDA = 7, "Devolução de pedido de venda"
        CANCELAMENTO_COMPRA = 10, "Cancelamento de pedido de compra"
        DEVOLUCAO_COMPRA = 11, "Devolução de pedido de compra"
        NOTA = 12, "Nota fiscal"
        INVENTARIO = 90, "Inventário"
        AJUSTE = 91, "Ajuste pela consulta"

    tipo = models.PositiveSmallIntegerField("tipo", choices=Tipo)
    origem = models.PositiveSmallIntegerField("origem", choices=Origem, null=True, blank=True)
    origem_id = models.BigIntegerField("número do documento de origem", null=True, blank=True)
    data = models.DateField("data")
    local_origem = models.ForeignKey(LocalEstoque, verbose_name="local de origem", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    local_destino = models.ForeignKey(LocalEstoque, verbose_name="local de destino", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    pessoa = models.CharField("pessoa", max_length=200, blank=True)
    informacoes = models.TextField("informações adicionais", blank=True)
    nota_numero = models.CharField("nº da nota", max_length=20, blank=True)
    nota_serie = models.CharField("série", max_length=5, blank=True)
    nota_emissao = models.DateField("emissão da nota", null=True, blank=True)
    nota_valor_adicional = models.DecimalField("valor adicional da nota", max_digits=14, decimal_places=2, default=0)
    motivo = models.ForeignKey(MotivoMovimentacao, verbose_name="motivo", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    perda_avaria = models.BooleanField("perda e avaria", default=False)
    total_quantidade = models.DecimalField("quantidade total", max_digits=14, decimal_places=3, default=0)
    total_valor = models.DecimalField("valor total", max_digits=14, decimal_places=2, default=0)
    manual = models.BooleanField("manual", default=True)

    class Meta:
        db_table = "estoque_movimentacao"
        ordering = ["-data", "-id"]
        verbose_name = "movimentação de estoque"
        verbose_name_plural = "movimentações de estoque"
        indexes = [models.Index(fields=["origem", "origem_id"]), models.Index(fields=["data"])]

    def __str__(self):
        return f"Movimentação {self.id}"


class ItemMovimentacao(models.Model):
    """Item da movimentação. `fator`: +1 entra no local, −1 sai (a transferência gera os dois)."""

    movimentacao = models.ForeignKey(Movimentacao, on_delete=models.CASCADE, related_name="itens")
    produto = models.ForeignKey("catalogo.Produto", on_delete=models.PROTECT, related_name="+")
    unidade = models.ForeignKey("catalogo.Unidade", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    quantidade = models.DecimalField("quantidade", max_digits=14, decimal_places=3)
    valor_unitario = models.DecimalField("valor", max_digits=14, decimal_places=2, default=0)
    lote = models.CharField("lote", max_length=40, blank=True)
    fabricacao = models.DateField("fabricação", null=True, blank=True)
    validade = models.DateField("validade", null=True, blank=True)

    class Meta:
        db_table = "estoque_movimentacao_item"
        ordering = ["id"]


class Inventario(ModeloBase):
    """
    Inventário do local (StockInventory): enquanto aberto, o local não movimenta. Ao concluir, a diferença entre
    o contado e o saldo vira uma movimentação de acerto.
    """

    class Status(models.IntegerChoices):
        ABERTO = 1, "Em andamento"
        CONCLUIDO = 2, "Concluído"
        CANCELADO = 3, "Cancelado"

    local = models.ForeignKey(LocalEstoque, on_delete=models.PROTECT, related_name="inventarios")
    status = models.PositiveSmallIntegerField("status", choices=Status, default=Status.ABERTO)
    inicio = models.DateTimeField("início", auto_now_add=True)
    fim = models.DateTimeField("fim", null=True, blank=True)
    movimentacao = models.ForeignKey(Movimentacao, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "estoque_inventario"
        ordering = ["-inicio"]
        verbose_name = "inventário"
        verbose_name_plural = "inventários"


class ItemInventario(models.Model):
    inventario = models.ForeignKey(Inventario, on_delete=models.CASCADE, related_name="itens")
    produto = models.ForeignKey("catalogo.Produto", on_delete=models.PROTECT, related_name="+")
    quantidade_sistema = models.DecimalField("saldo no início", max_digits=14, decimal_places=3, default=0)
    quantidade_contada = models.DecimalField("contado", max_digits=14, decimal_places=3, null=True, blank=True)

    class Meta:
        db_table = "estoque_inventario_item"
        constraints = [models.UniqueConstraint(fields=["inventario", "produto"], name="inventario_produto_unico")]
