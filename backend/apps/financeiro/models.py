from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import ModeloBase

# Ajustes › Financeiro da MarketUP (context/marketup/telas-e-entidades.md,
# seção "Ajustes › Financeiro em detalhe"). Os IDs são os da MarketUP; não há
# dados iniciais: a carga vem da migração.


class ContaGerencial(ModeloBase):
    """Plano de contas gerencial (management_account). ID = ID da MarketUP."""

    class Tipo(models.TextChoices):
        SAIDA = "S", "Saída"
        ENTRADA = "E", "Entrada"

    class ClassificacaoDRE(models.TextChoices):
        # Saídas
        ALUGUEL = "aluguel", "Aluguel, condomínio e IPTU"
        CUSTO_MERCADORIA = "custo_mercadoria", "Custo da mercadoria"
        DESPESAS_FINANCEIRAS = "despesas_financeiras", "Despesas financeiras"
        GERAIS_ADMINISTRATIVAS = "gerais_administrativas", "Gerais e administrativas"
        IMPOSTOS_DEVOLUCOES = "impostos_devolucoes", "Impostos e devoluções"
        PESSOAL = "pessoal", "Pessoal"
        PRO_LABORE = "pro_labore", "Pro labore"
        PROPAGANDA_MARKETING = "propaganda_marketing", "Propaganda e marketing"
        UTILIDADES = "utilidades", "Utilidades"
        # Entradas
        RECEITAS_FINANCEIRAS = "receitas_financeiras", "Receitas financeiras"
        ENTRADAS = "entradas", "Entradas"

    tipo = models.CharField("tipo", max_length=1, choices=Tipo, default=Tipo.SAIDA)
    conta_origem = models.ForeignKey(
        "self", verbose_name="conta origem", on_delete=models.PROTECT, null=True, blank=True, related_name="subcontas"
    )
    posicao_relativa = models.IntegerField("posição relativa", default=0)
    codigo_referencia = models.CharField("código referência", max_length=30, blank=True)
    classificacao_dre = models.CharField("classificação DRE", max_length=30, choices=ClassificacaoDRE, blank=True)
    nome = models.CharField("nome", max_length=120)
    cc_debito = models.CharField("CC débito", max_length=60, blank=True)
    cc_credito = models.CharField("CC crédito", max_length=60, blank=True)
    compras = models.BooleanField("compras", default=False)
    ativo = models.BooleanField("ativo", default=True)
    sistema = models.BooleanField("conta do sistema", default=False)

    class Meta:
        db_table = "conta_gerencial"
        ordering = ["codigo_referencia", "posicao_relativa", "nome"]
        verbose_name = "conta gerencial"
        verbose_name_plural = "contas gerenciais"

    def __str__(self):
        return f"{self.codigo_referencia} {self.nome}".strip()


class Banco(ModeloBase):
    """Lista oficial de bancos (endpoint Bank da MarketUP)."""

    codigo = models.CharField("código", max_length=10, unique=True)
    nome = models.CharField("nome", max_length=200)

    class Meta:
        db_table = "banco"
        ordering = ["codigo"]
        verbose_name = "banco"
        verbose_name_plural = "bancos"

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class ContaCorrente(ModeloBase):
    """Conta corrente (account). Interna = caixa/PDV; externa = banco ou carteira."""

    nome = models.CharField("nome", max_length=120)
    interna = models.BooleanField("interna", default=False)
    banco = models.ForeignKey(
        Banco, verbose_name="banco", on_delete=models.PROTECT, null=True, blank=True, related_name="contas"
    )
    agencia = models.CharField("agência", max_length=10, blank=True)
    agencia_digito = models.CharField("dígito da agência", max_length=2, blank=True)
    conta = models.CharField("conta", max_length=20, blank=True)
    conta_digito = models.CharField("dígito da conta", max_length=2, blank=True)
    principal = models.BooleanField("principal", default=False)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        db_table = "conta_corrente"
        ordering = ["nome"]
        verbose_name = "conta corrente"
        verbose_name_plural = "contas correntes"

    def __str__(self):
        return self.nome


class TipoPagamento(ModeloBase):
    """Tipo de pagamento (payment_type). "Utiliza no PDV?" fica fora (PDV fora do escopo)."""

    descricao = models.CharField("descrição", max_length=120)
    inicio_contrato = models.DateField("início contrato", null=True, blank=True)
    fim_contrato = models.DateField("fim contrato", null=True, blank=True)
    carencia = models.PositiveIntegerField("carência (dias)", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        db_table = "tipo_pagamento"
        ordering = ["descricao"]
        verbose_name = "tipo de pagamento"
        verbose_name_plural = "tipos de pagamento"

    def __str__(self):
        return self.descricao


class CondicaoPagamento(ModeloBase):
    """Condição de pagamento de um tipo (ex.: "Entrada + 02x sem juros")."""

    tipo = models.ForeignKey(TipoPagamento, verbose_name="tipo de pagamento", on_delete=models.CASCADE, related_name="condicoes")
    descricao = models.CharField("descrição", max_length=120)
    parcelas = models.PositiveIntegerField("parcelas", default=1, validators=[MinValueValidator(1)])
    intervalo = models.PositiveIntegerField("intervalo (dias)", default=0)
    primeira_parcela = models.PositiveIntegerField("1ª parcela (dias)", default=0)
    percentual_adm = models.DecimalField("% adm", max_digits=5, decimal_places=2, default=0)
    percentual_antecipacao = models.DecimalField("% antecipação", max_digits=5, decimal_places=2, default=0)
    valor_fixo = models.DecimalField("valor fixo", max_digits=12, decimal_places=2, default=0)
    classificacao = models.CharField("classificação", max_length=60, blank=True)
    compras = models.BooleanField("compras", default=False)
    vendas = models.BooleanField("vendas", default=True)

    class Meta:
        db_table = "condicao_pagamento"
        ordering = ["tipo", "id"]
        verbose_name = "condição de pagamento"
        verbose_name_plural = "condições de pagamento"

    def __str__(self):
        return self.descricao




# ---- Títulos, baixas e caixa (Event, EntryEvent, Entry e Transfer da MarketUP) ----
# context/marketup/telas-e-entidades.md, seção "Financeiro (T302)".


class OrigemFinanceira(models.IntegerChoices):
    """FinancialOriginsEnum da MarketUP (mesmos números)."""

    DESPESAS = 2, "Despesas"
    RECEITAS = 3, "Receitas"
    IMPOSTOS = 4, "Impostos"
    COMISSOES = 5, "Comissões"
    COMPRAS = 6, "Compras"
    VENDAS = 7, "Vendas"
    PDV = 8, "PDV"
    OS = 11, "OS"


class Titulo(ModeloBase):
    """Campos comuns do título a receber e a pagar (Event)."""

    Origem = OrigemFinanceira

    origem = models.PositiveSmallIntegerField("origem", choices=OrigemFinanceira, default=OrigemFinanceira.RECEITAS)
    origem_id = models.BigIntegerField("número do documento de origem", null=True, blank=True)
    manual = models.BooleanField("lançado à mão", default=False)
    conta_gerencial = models.ForeignKey(ContaGerencial, verbose_name="classificação", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="forma de pagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    descricao = models.CharField("descrição", max_length=300)
    documento = models.CharField("nº do documento", max_length=60, blank=True)
    codigo_barras = models.CharField("código de barras", max_length=60, blank=True)
    observacao = models.TextField("observações", blank=True)
    parcela = models.PositiveSmallIntegerField("parcela", default=1)
    parcelas = models.PositiveSmallIntegerField("de", default=1)
    emissao = models.DateField("emissão")
    vencimento = models.DateField("vencimento")
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    saldo = models.DecimalField("saldo", max_digits=14, decimal_places=2)
    cancelada = models.BooleanField("cancelada", default=False)

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.descricao} ({self.parcela}/{self.parcelas})"


class ContaReceber(Titulo):
    """Título a receber (Event com IsCredit). Pedido: origem 7 (Vendas), número = pedido."""

    parcela_pedido = models.ForeignKey(
        "vendas.ParcelaPedido", verbose_name="parcela do pedido", on_delete=models.SET_NULL, null=True, blank=True, related_name="contas"
    )
    cliente = models.ForeignKey("clientes.Cliente", verbose_name="sacado", on_delete=models.PROTECT, null=True, blank=True, related_name="contas_receber")

    class Meta:
        db_table = "conta_receber"
        ordering = ["vencimento", "id"]
        verbose_name = "conta a receber"
        verbose_name_plural = "contas a receber"
        indexes = [models.Index(fields=["origem", "origem_id"]), models.Index(fields=["vencimento"])]


class ContaPagar(Titulo):
    """Título a pagar (Event a débito). Beneficiário: fornecedor (compras), funcionário (ex.: comissão) ou cliente."""

    fornecedor = models.ForeignKey(
        "compras.Fornecedor", verbose_name="beneficiário (fornecedor)", on_delete=models.PROTECT, null=True, blank=True, related_name="contas_pagar"
    )
    # Pedido de compra: origem 6 (Compras), número = pedido; a parcela é a do pedido (PurchaseOrderInstallment.EventID).
    parcela_compra = models.ForeignKey(
        "compras.ParcelaPedidoCompra", verbose_name="parcela do pedido de compra", on_delete=models.SET_NULL, null=True, blank=True, related_name="contas"
    )

    funcionario = models.ForeignKey(
        "usuarios.Funcionario", verbose_name="beneficiário (funcionário)", on_delete=models.PROTECT, null=True, blank=True, related_name="contas_pagar"
    )
    cliente = models.ForeignKey("clientes.Cliente", verbose_name="beneficiário (cliente)", on_delete=models.PROTECT, null=True, blank=True, related_name="contas_pagar")
    beneficiario_nome = models.CharField("beneficiário (nome livre)", max_length=200, blank=True)

    class Meta:
        db_table = "conta_pagar"
        ordering = ["vencimento", "id"]
        verbose_name = "conta a pagar"
        verbose_name_plural = "contas a pagar"
        indexes = [models.Index(fields=["origem", "origem_id"]), models.Index(fields=["vencimento"])]


class Transferencia(ModeloBase):
    """Transferência entre contas correntes (FinancialTransfer): saída numa conta e entrada na outra."""

    data = models.DateField("data")
    conta_origem = models.ForeignKey(ContaCorrente, verbose_name="conta de origem", on_delete=models.PROTECT, related_name="+")
    conta_destino = models.ForeignKey(ContaCorrente, verbose_name="conta de destino", on_delete=models.PROTECT, related_name="+")
    documento = models.CharField("nº doc", max_length=60, blank=True)
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="efetuado em", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    observacao = models.CharField("descrição/observação", max_length=300, blank=True)

    class Meta:
        db_table = "transferencia"
        ordering = ["-data", "-id"]
        verbose_name = "transferência"
        verbose_name_plural = "transferências"


class LancamentoCaixa(ModeloBase):
    """
    Movimento na conta corrente (Entry): entrada (crédito) ou saída (débito).
    Liga-se ao título da baixa, a uma transferência, ou a nada (estorno do cancelamento de pedido).
    """

    data = models.DateField("data")
    conta_corrente = models.ForeignKey(ContaCorrente, verbose_name="conta corrente", on_delete=models.PROTECT, null=True, blank=True, related_name="lancamentos")
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="forma", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    credito = models.BooleanField("entrada", default=True)
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    descricao = models.CharField("descrição", max_length=300)
    manual = models.BooleanField("manual", default=False)
    conta_gerencial = models.ForeignKey(ContaGerencial, verbose_name="classificação", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    origem = models.PositiveSmallIntegerField("origem", choices=OrigemFinanceira, default=OrigemFinanceira.RECEITAS)
    origem_id = models.BigIntegerField("número do documento de origem", null=True, blank=True)
    conta_receber = models.ForeignKey(ContaReceber, on_delete=models.CASCADE, null=True, blank=True, related_name="lancamentos")
    conta_pagar = models.ForeignKey(ContaPagar, on_delete=models.CASCADE, null=True, blank=True, related_name="lancamentos")
    transferencia = models.ForeignKey(Transferencia, on_delete=models.CASCADE, null=True, blank=True, related_name="lancamentos")

    class Meta:
        db_table = "lancamento_caixa"
        ordering = ["-data", "-id"]
        verbose_name = "lançamento de caixa"
        verbose_name_plural = "lançamentos de caixa"
        indexes = [models.Index(fields=["data"])]


class Baixa(ModeloBase):
    """Baixa de um título (EntryEvent): valor pago/recebido, desconto e juros. Amortizado = valor + desconto − juros."""

    data = models.DateField("data")
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    desconto = models.DecimalField("desconto", max_digits=14, decimal_places=2, default=0)
    juros = models.DecimalField("juros", max_digits=14, decimal_places=2, default=0)
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="efetuado em", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    conta_corrente = models.ForeignKey(ContaCorrente, verbose_name="conta corrente", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    lancamento = models.OneToOneField(LancamentoCaixa, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    observacao = models.CharField("observação", max_length=300, blank=True)

    class Meta:
        abstract = True
        ordering = ["data", "id"]

    @property
    def amortizado(self):
        return self.valor + self.desconto - self.juros


class Recebimento(Baixa):
    conta = models.ForeignKey(ContaReceber, verbose_name="conta a receber", on_delete=models.CASCADE, related_name="recebimentos")

    class Meta(Baixa.Meta):
        db_table = "recebimento"
        verbose_name = "recebimento"
        verbose_name_plural = "recebimentos"


class Pagamento(Baixa):
    conta = models.ForeignKey(ContaPagar, verbose_name="conta a pagar", on_delete=models.CASCADE, related_name="pagamentos")

    class Meta(Baixa.Meta):
        db_table = "pagamento"
        verbose_name = "pagamento"
        verbose_name_plural = "pagamentos"
