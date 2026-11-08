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


# ---- Contas a receber e caixa (receivable / Event, EntryEvent e Entry da MarketUP) ----
# A T203 cria o mínimo que o pedido usa (título por parcela, recebimento, estorno e recibo);
# a tela completa de contas a receber e o fluxo de caixa ficam na T302.


class ContaReceber(ModeloBase):
    """Título a receber (Event com IsCredit). Pedido: OriginID 7 (Vendas), OriginKey = número do pedido."""

    class Origem(models.IntegerChoices):
        MANUAL = 0, "Manual"
        VENDAS = 7, "Vendas"
        OS = 11, "Ordem de serviço"

    origem = models.PositiveSmallIntegerField("origem", choices=Origem, default=Origem.MANUAL)
    origem_id = models.BigIntegerField("número do documento de origem", null=True, blank=True)
    parcela_pedido = models.ForeignKey(
        "vendas.ParcelaPedido", verbose_name="parcela do pedido", on_delete=models.SET_NULL, null=True, blank=True, related_name="contas"
    )
    cliente = models.ForeignKey("clientes.Cliente", verbose_name="sacado", on_delete=models.PROTECT, null=True, blank=True, related_name="contas_receber")
    conta_gerencial = models.ForeignKey(ContaGerencial, verbose_name="conta gerencial", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="forma de pagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    descricao = models.CharField("descrição", max_length=300)
    parcela = models.PositiveSmallIntegerField("parcela", default=1)
    parcelas = models.PositiveSmallIntegerField("de", default=1)
    emissao = models.DateField("emissão")
    vencimento = models.DateField("vencimento")
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    saldo = models.DecimalField("saldo", max_digits=14, decimal_places=2)
    cancelada = models.BooleanField("cancelada", default=False)

    class Meta:
        db_table = "conta_receber"
        ordering = ["vencimento", "id"]
        verbose_name = "conta a receber"
        verbose_name_plural = "contas a receber"
        indexes = [models.Index(fields=["origem", "origem_id"]), models.Index(fields=["vencimento"])]

    def __str__(self):
        return f"{self.descricao} ({self.parcela}/{self.parcelas})"


class LancamentoCaixa(ModeloBase):
    """Movimento na conta corrente (Entry): entrada de um recebimento ou saída de um estorno."""

    data = models.DateField("data")
    conta_corrente = models.ForeignKey(ContaCorrente, verbose_name="conta corrente", on_delete=models.PROTECT, null=True, blank=True, related_name="lancamentos")
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="forma", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    credito = models.BooleanField("entrada", default=True)
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    descricao = models.CharField("descrição", max_length=300)
    origem = models.PositiveSmallIntegerField("origem", choices=ContaReceber.Origem, default=ContaReceber.Origem.MANUAL)
    origem_id = models.BigIntegerField("número do documento de origem", null=True, blank=True)

    class Meta:
        db_table = "lancamento_caixa"
        ordering = ["-data", "-id"]
        verbose_name = "lançamento de caixa"
        verbose_name_plural = "lançamentos de caixa"


class Recebimento(ModeloBase):
    """Baixa de um título (EntryEvent): valor amortizado, desconto e juros. Estornar desfaz a baixa e lança a saída."""

    conta = models.ForeignKey(ContaReceber, verbose_name="conta a receber", on_delete=models.CASCADE, related_name="recebimentos")
    data = models.DateField("data")
    valor = models.DecimalField("valor recebido", max_digits=14, decimal_places=2)
    desconto = models.DecimalField("desconto", max_digits=14, decimal_places=2, default=0)
    juros = models.DecimalField("juros", max_digits=14, decimal_places=2, default=0)
    tipo_pagamento = models.ForeignKey(TipoPagamento, verbose_name="efetuado em", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    conta_corrente = models.ForeignKey(ContaCorrente, verbose_name="conta corrente", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    lancamento = models.ForeignKey(LancamentoCaixa, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    estornado_em = models.DateTimeField("estornado em", null=True, blank=True)

    class Meta:
        db_table = "recebimento"
        ordering = ["data", "id"]
        verbose_name = "recebimento"
        verbose_name_plural = "recebimentos"

    @property
    def amortizado(self):
        """Quanto o recebimento abate do saldo: recebido − juros + desconto."""
        return self.valor - self.juros + self.desconto
