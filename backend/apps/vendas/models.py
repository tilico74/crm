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


# ---- Documentos de venda: orçamento (sale_budget) e pedido (sale_order) da MarketUP ----
# context/marketup/telas-e-entidades.md. Os dois têm o mesmo cabeçalho, itens e parcelas.


class DocumentoVenda(ModeloBase):
    """Campos comuns ao orçamento e ao pedido. ID = número da MarketUP (SaleBudgetID / SaleOrderID)."""

    cliente = models.ForeignKey(
        "clientes.Cliente", verbose_name="cliente", on_delete=models.PROTECT, null=True, blank=True, related_name="%(class)ss"
    )
    endereco_faturamento = models.ForeignKey(
        "clientes.EnderecoCliente", verbose_name="endereço para faturamento", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    endereco_entrega = models.ForeignKey(
        "clientes.EnderecoCliente", verbose_name="endereço de entrega", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    vendedor = models.ForeignKey(
        "usuarios.Funcionario", verbose_name="vendedor", on_delete=models.PROTECT, null=True, blank=True, related_name="%(class)ss"
    )
    emissao = models.DateField("emissão")
    entrega = models.DateField("entrega", null=True, blank=True)
    data_cancelamento = models.DateTimeField("data do cancelamento", null=True, blank=True)
    observacao = models.TextField("comentários", blank=True)

    # Totais (calculados no back-end a cada gravação)
    subtotal = models.DecimalField("subtotal", max_digits=14, decimal_places=2, default=0)
    desconto = models.DecimalField("desconto (R$)", max_digits=14, decimal_places=2, default=0)
    desconto_percentual = models.DecimalField("desconto (%)", max_digits=7, decimal_places=4, default=0)
    desconto_em_percentual = models.BooleanField("desconto digitado em %", default=False)
    frete = models.DecimalField("frete", max_digits=14, decimal_places=2, default=0)
    outros_custos = models.DecimalField("outros custos", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("total", max_digits=14, decimal_places=2, default=0)

    class Meta:
        abstract = True


class ItemVenda(models.Model):
    """Item do documento de venda: produto ou serviço, com as medidas na observação."""

    produto = models.ForeignKey("catalogo.Produto", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    servico = models.ForeignKey("catalogo.Servico", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    descricao = models.CharField("descrição", max_length=300)  # cópia do nome na hora da venda
    unidade = models.ForeignKey("catalogo.Unidade", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    quantidade = models.DecimalField("quantidade", max_digits=14, decimal_places=3)
    valor_unitario = models.DecimalField("unitário", max_digits=14, decimal_places=2)
    desconto = models.DecimalField("desconto (R$)", max_digits=14, decimal_places=2, default=0)
    desconto_percentual = models.DecimalField("desconto (%)", max_digits=7, decimal_places=4, default=0)
    desconto_em_percentual = models.BooleanField("desconto digitado em %", default=False)
    subtotal = models.DecimalField("subtotal", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("total", max_digits=14, decimal_places=2, default=0)
    fragmentado = models.BooleanField("vendido fracionado", default=False)
    observacao = models.CharField("observação", max_length=500, blank=True)
    ordem = models.PositiveIntegerField("ordem", default=0)

    class Meta:
        abstract = True


class ParcelaVenda(models.Model):
    """Parcela gerada em "Gerar contas" (SaleBudgetInstallment / SaleOrderInstallment)."""

    numero = models.PositiveSmallIntegerField("parcela")
    quantidade = models.PositiveSmallIntegerField("de")
    vencimento = models.DateField("vencimento")
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    descricao = models.CharField("observações", max_length=300, blank=True)
    # Parcelas geradas no mesmo "Gerar contas" (PaymentGuid da MarketUP): aparecem juntas e saem juntas na lixeira.
    grupo = models.CharField("grupo do pagamento", max_length=40, blank=True)
    tipo_pagamento = models.ForeignKey("financeiro.TipoPagamento", on_delete=models.PROTECT, related_name="+")
    condicao_pagamento = models.ForeignKey("financeiro.CondicaoPagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        abstract = True


# ---- Orçamento de venda (sale_budget) ----


class Orcamento(DocumentoVenda):
    """Orçamento de venda. ID = SaleBudgetID (o número mostrado na tela)."""

    class Status(models.IntegerChoices):
        # Valores da MarketUP (filtro Status da listagem).
        NOVO = 1, "Novo"
        PEDIDO = 3, "Pedido"
        CANCELADO = 4, "Cancelado"
        CONCLUIDO = 6, "Concluído"

    status = models.PositiveSmallIntegerField("status", choices=Status, default=Status.NOVO)
    validade = models.DateField("validade", null=True, blank=True)
    data_pedido = models.DateTimeField("data do pedido", null=True, blank=True)
    # Pedido gerado (SaleOrderID). Número solto: na carga, o pedido pode vir antes ou depois do orçamento.
    pedido_id = models.BigIntegerField("pedido gerado", null=True, blank=True)

    class Meta:
        db_table = "orcamento"
        ordering = ["-id"]
        verbose_name = "orçamento"
        verbose_name_plural = "orçamentos"
        indexes = [models.Index(fields=["status"]), models.Index(fields=["emissao"])]

    def __str__(self):
        return f"Orçamento {self.id}"


class ItemOrcamento(ItemVenda):
    """Item do orçamento (SaleBudgetItem)."""

    orcamento = models.ForeignKey(Orcamento, on_delete=models.CASCADE, related_name="itens")

    class Meta:
        db_table = "orcamento_item"
        ordering = ["ordem", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(produto__isnull=False, servico__isnull=True) | models.Q(produto__isnull=True, servico__isnull=False),
                name="orcamento_item_produto_ou_servico",
            )
        ]
        verbose_name = "item do orçamento"
        verbose_name_plural = "itens do orçamento"


class ParcelaOrcamento(ParcelaVenda):
    orcamento = models.ForeignKey(Orcamento, on_delete=models.CASCADE, related_name="parcelas")

    class Meta:
        db_table = "orcamento_parcela"
        ordering = ["vencimento", "numero", "id"]
        verbose_name = "parcela do orçamento"
        verbose_name_plural = "parcelas do orçamento"


# ---- Pedido de venda (sale_order) ----


class Pedido(DocumentoVenda):
    """
    Pedido de venda. ID = SaleOrderID. Status, entrega e financeiro com os números da MarketUP
    (SaleOrderStatusEnum, SaleOrderStatusDeliveryEnum, SaleOrderStatusFinancialEnum).
    "Atrasado" (entrega ou financeiro) não é gravado: sai da data na hora da consulta.
    """

    class Status(models.IntegerChoices):
        NOVO = 1, "Novo"
        FATURADO = 2, "Faturado"
        FINALIZADO = 6, "Finalizado"
        CANCELADO = 7, "Cancelado"

    class Entrega(models.IntegerChoices):
        PENDENTE = 1, "Pendente"
        ENTREGUE = 2, "Entregue"
        PARCIAL = 3, "Entregue parcialmente"
        ATRASADO = 4, "Atrasado"
        CANCELADO = 7, "Cancelado"

    class Financeiro(models.IntegerChoices):
        PENDENTE = 1, "Pendente"
        PAGO = 2, "Pago"
        PARCIAL = 3, "Pago parcialmente"
        ATRASADO = 4, "Atrasado"
        CANCELADO = 7, "Cancelado"

    status = models.PositiveSmallIntegerField("status", choices=Status, default=Status.NOVO)
    situacao_entrega = models.PositiveSmallIntegerField("status da entrega", choices=Entrega, default=Entrega.PENDENTE)
    situacao_financeira = models.PositiveSmallIntegerField("status do pagamento", choices=Financeiro, default=Financeiro.PENDENTE)
    orcamento = models.ForeignKey(
        Orcamento, verbose_name="orçamento de origem", on_delete=models.SET_NULL, null=True, blank=True, related_name="pedidos"
    )
    data_faturamento = models.DateTimeField("faturado em", null=True, blank=True)
    data_entregue = models.DateField("entregue em", null=True, blank=True)

    class Meta:
        db_table = "pedido"
        ordering = ["-id"]
        verbose_name = "pedido"
        verbose_name_plural = "pedidos"
        indexes = [models.Index(fields=["status"]), models.Index(fields=["emissao"])]

    def __str__(self):
        return f"Pedido {self.id}"


class ItemPedido(ItemVenda):
    """Item do pedido (SaleOrderItem). `entregue` = quantidade já entregue (Delivered)."""

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="itens")
    entregue = models.DecimalField("entregue", max_digits=14, decimal_places=3, default=0)

    class Meta:
        db_table = "pedido_item"
        ordering = ["ordem", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(produto__isnull=False, servico__isnull=True) | models.Q(produto__isnull=True, servico__isnull=False),
                name="pedido_item_produto_ou_servico",
            )
        ]
        verbose_name = "item do pedido"
        verbose_name_plural = "itens do pedido"


class ParcelaPedido(ParcelaVenda):
    """Parcela do pedido. Ao concluir a venda, cada uma vira uma conta a receber (EventID da MarketUP)."""

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="parcelas")

    class Meta:
        db_table = "pedido_parcela"
        ordering = ["vencimento", "numero", "id"]
        verbose_name = "parcela do pedido"
        verbose_name_plural = "parcelas do pedido"
