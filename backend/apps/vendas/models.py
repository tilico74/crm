from django.db import models

from apps.core.models import ModeloBase


class ParametrosVenda(ModeloBase):
    """
    Ajustes › Empresa › Parâmetros de venda. Registro único (id = 1).
    Padrões = valores da RDX na MarketUP em 07/11/2026. A parte de PDV fica fora (escopo).
    """

    class Antecedencia(models.IntegerChoices):
        CINCO = 5, "5 dias"
        DEZ = 10, "10 dias"
        QUINZE = 15, "15 dias"

    class Valorizacao(models.TextChoices):
        CMP = "CMP", "CMP (custo médio ponderado)"
        PEPS = "PEPS", "PEPS (primeiro que entra, primeiro que sai)"

    class Impressao(models.TextChoices):
        MM80 = "80mm", "80mm"
        MM58 = "58mm", "58mm"
        A4 = "A4", "A4"

    NOMES_SERVICO = ["Ordem de Serviço", "Atendimento", "Consulta", "Contrato", "Fatura de serviço", "Job", "Pedido", "Venda"]

    # Prazos (dias)
    compra_validade_orcamento = models.PositiveSmallIntegerField("compras: prazo de validade para orçamento", default=15)
    compra_entrega_pedido = models.PositiveSmallIntegerField("compras: entrega para pedido", default=7)
    compra_entrega_orcamento = models.PositiveSmallIntegerField("compras: entrega para orçamento", default=30)
    venda_validade_orcamento = models.PositiveSmallIntegerField("vendas: prazo de validade para orçamento", default=15)
    venda_entrega_pedido = models.PositiveSmallIntegerField("vendas: entrega para pedido", default=10)
    venda_entrega_orcamento = models.PositiveSmallIntegerField("vendas: entrega para orçamento", default=10)
    antecedencia_venda_recorrente = models.PositiveSmallIntegerField(
        "prazo de antecedência para venda recorrente", choices=Antecedencia, default=Antecedencia.CINCO
    )
    # Crédito
    utilizar_limite_credito = models.BooleanField("utilizar limite de crédito", default=True)
    limite_credito_novos = models.DecimalField(
        "limite de crédito para novos clientes", max_digits=12, decimal_places=2, default=1000
    )
    # Desconto
    desconto_maximo_pedido = models.DecimalField("desconto máximo no pedido (%)", max_digits=5, decimal_places=2, default=100)
    # Estoque
    bloquear_venda_estoque_negativo = models.BooleanField("bloquear venda com estoque negativo", default=False)
    movimentar_estoque_importacao_xml = models.BooleanField("movimentação de estoque via importação de XML", default=False)
    produto_pedido_compra_movimenta = models.BooleanField(
        "cadastro de produtos via pedido de compra: movimentação de estoque", default=False
    )
    produto_pedido_venda_movimenta = models.BooleanField(
        "cadastro de produtos via pedido de venda: movimentação de estoque", default=False
    )
    metodo_valorizacao_estoque = models.CharField(
        "método de valorização do estoque", max_length=4, choices=Valorizacao, default=Valorizacao.PEPS
    )
    notificar_vencimento_estoque = models.BooleanField("receber notificações do vencimento do estoque", default=False)
    # Fiscal, impressão, importação e serviços
    informacoes_fiscais = models.BooleanField("informações fiscais", default=False)
    formato_impressao = models.CharField("formato de impressão", max_length=4, choices=Impressao, default=Impressao.A4)
    ipi_importacao_xml = models.BooleanField("ativar IPI na importação de XML", default=False)
    nome_servico = models.CharField(
        "personalização do serviço", max_length=30, choices=[(n, n) for n in NOMES_SERVICO], default="Ordem de Serviço"
    )

    class Meta:
        db_table = "parametros_venda"
        verbose_name = "parâmetros de venda"
        verbose_name_plural = "parâmetros de venda"

    def __str__(self):
        return "Parâmetros de venda"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def atual(cls) -> "ParametrosVenda":
        return cls.objects.get_or_create(pk=1)[0]
