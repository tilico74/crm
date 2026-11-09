"""
Comissões de vendedores (T205), no modelo da MarketUP (seller_commission e seller_commission_closing).
Regras em context/regras-de-negocio/comissoes.md (decididas pelo usuário em 09/11/2026).
"""

from django.db import models

from apps.core.models import ModeloBase


class FechamentoComissao(ModeloBase):
    """Aprovação de comissões (SellerCommissionClosing): junta lançamentos e gera as contas a pagar."""

    data = models.DateField("data")
    descricao = models.CharField("descrição", max_length=300, blank=True)
    valor_total = models.DecimalField("valor total", max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = "comissao_fechamento"
        ordering = ["-data", "-id"]
        verbose_name = "fechamento de comissões"
        verbose_name_plural = "fechamentos de comissões"

    def __str__(self):
        return f"Fechamento {self.id}"


class Comissao(ModeloBase):
    """
    Lançamento de comissão (SellerCommission). Automático ao concluir o pedido ou manual.
    Estorno (pedido cancelado depois do fechamento) = lançamento negativo que aponta para o original.
    """

    class Tipo(models.IntegerChoices):
        AUTOMATICO = 0, "Automático"
        MANUAL = 1, "Manual"

    tipo = models.PositiveSmallIntegerField("tipo", choices=Tipo, default=Tipo.MANUAL)
    vendedor = models.ForeignKey("usuarios.Funcionario", verbose_name="comissionado", on_delete=models.PROTECT, related_name="comissoes")
    pedido = models.ForeignKey("vendas.Pedido", verbose_name="pedido", on_delete=models.SET_NULL, null=True, blank=True, related_name="comissoes")
    emissao = models.DateField("data")
    fechamento = models.ForeignKey(
        FechamentoComissao, verbose_name="fechamento", on_delete=models.SET_NULL, null=True, blank=True, related_name="comissoes"
    )
    estorno_de = models.OneToOneField(
        "self", verbose_name="estorno do lançamento", on_delete=models.SET_NULL, null=True, blank=True, related_name="estorno"
    )
    observacao = models.CharField("observações", max_length=300, blank=True)
    valor_venda = models.DecimalField("venda", max_digits=14, decimal_places=2)
    percentual = models.DecimalField("% comissão", max_digits=7, decimal_places=2, default=0)
    valor = models.DecimalField("comissão", max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = "comissao"
        ordering = ["-emissao", "-id"]
        verbose_name = "comissão"
        verbose_name_plural = "comissões"
        indexes = [models.Index(fields=["emissao"])]

    def __str__(self):
        return f"Comissão {self.id}"
