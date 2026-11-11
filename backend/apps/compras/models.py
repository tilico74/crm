from django.db import models

from apps.core.documentos import validar_cnpj, validar_cpf
from apps.core.models import ModeloBase
from apps.core.normalizacao import normalizar_nome

# Estoque › Compras da MarketUP (context/marketup/telas-e-entidades.md, "Estoque e Compras (T301)").
# IDs = os da MarketUP: SupplierID, SupplierTypeID.


class TipoFornecedor(ModeloBase):
    """Ajustes › Pessoas › Tipos de fornecedor (supplier_type). 1 Geral, 2 Matéria Prima, 3 Material de Escritório, 4 Serviços, 5 Entregas."""

    nome = models.CharField("nome", max_length=300)

    class Meta:
        db_table = "tipo_fornecedor"
        ordering = ["nome"]
        verbose_name = "tipo de fornecedor"
        verbose_name_plural = "tipos de fornecedor"

    def __str__(self):
        return self.nome


class Fornecedor(ModeloBase):
    """
    Fornecedor com a ficha da MarketUP (igual à do cliente, sem lista de preços nem crédito). ID = SupplierID.

    Como no cliente, `nome` é o Nome (física) ou a Razão Social (jurídica) e `apelido` é o Apelido ou o
    Nome Fantasia (OfficialName / Name).
    """

    class TipoPessoa(models.TextChoices):
        FISICA = "F", "Física"
        JURIDICA = "J", "Jurídica"

    class Sexo(models.TextChoices):
        MASCULINO = "M", "Masculino"
        FEMININO = "F", "Feminino"

    class IndicadorIE(models.IntegerChoices):
        CONTRIBUINTE = 1, "Contribuinte do ICMS"
        ISENTO = 2, "Contribuinte Isento de Inscrição"
        NAO_CONTRIBUINTE = 3, "Não Contribuinte"

    tipo_pessoa = models.CharField("pessoa física ou jurídica", max_length=1, choices=TipoPessoa, default=TipoPessoa.JURIDICA)
    tipo = models.ForeignKey(TipoFornecedor, verbose_name="tipo", on_delete=models.PROTECT, default=1, related_name="fornecedores")
    bloqueado = models.BooleanField("bloqueado", default=False)
    nome = models.CharField("nome / razão social", max_length=300)
    apelido = models.CharField("apelido / nome fantasia", max_length=300, blank=True)
    cpf = models.CharField("CPF", max_length=11, blank=True, validators=[validar_cpf])
    rg = models.CharField("RG", max_length=20, blank=True)
    rg_emissor = models.CharField("emissor", max_length=100, blank=True)
    rg_uf = models.CharField("UF", max_length=2, blank=True)
    sexo = models.CharField("sexo", max_length=1, choices=Sexo, blank=True)
    aniversario = models.DateField("aniversário", null=True, blank=True)
    cnpj = models.CharField("CNPJ", max_length=14, blank=True, validators=[validar_cnpj])
    indicador_ie = models.PositiveSmallIntegerField("indicador da IE do destinatário", choices=IndicadorIE, null=True, blank=True)
    inscricao_estadual = models.CharField("inscrição estadual", max_length=20, blank=True)
    inscricao_municipal = models.CharField("inscrição municipal", max_length=20, blank=True)
    telefone = models.CharField("telefone", max_length=15, blank=True)
    celular = models.CharField("celular", max_length=15, blank=True)
    email = models.EmailField("email", max_length=254, blank=True)
    site = models.CharField("site", max_length=150, blank=True)
    email_nfe = models.EmailField("email do destinatário da NFe", max_length=254, blank=True)
    observacao = models.CharField("observação", max_length=300, blank=True)
    transportadora = models.BooleanField("é transportadora?", default=False)
    produtor_rural = models.BooleanField("produtor rural?", default=False)

    class Meta:
        db_table = "fornecedor"
        ordering = ["nome"]
        verbose_name = "fornecedor"
        verbose_name_plural = "fornecedores"
        indexes = [models.Index(fields=["cpf"]), models.Index(fields=["cnpj"])]

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        # ADR-007: só nome de pessoa é padronizado; razão social e nome fantasia ficam como digitados.
        if self.tipo_pessoa == self.TipoPessoa.FISICA:
            self.nome = normalizar_nome(self.nome) or ""
            self.apelido = normalizar_nome(self.apelido) or ""
        self.rg_uf = self.rg_uf.upper()
        super().save(*args, **kwargs)


class EnderecoFornecedor(models.Model):
    """Aba Endereços: vários por fornecedor, um padrão."""

    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name="enderecos")
    cep = models.CharField("CEP", max_length=8, blank=True)
    exterior = models.BooleanField("no exterior", default=False)
    logradouro = models.CharField("endereço", max_length=100, blank=True)
    numero = models.CharField("nº", max_length=10, blank=True)
    complemento = models.CharField("complemento", max_length=50, blank=True)
    bairro = models.CharField("bairro", max_length=50, blank=True)
    cidade = models.CharField("cidade", max_length=80, blank=True)
    uf = models.CharField("UF", max_length=2, blank=True)
    ibge = models.CharField("código IBGE do município", max_length=7, blank=True)
    ativo = models.BooleanField("ativo", default=True)
    padrao = models.BooleanField("padrão", default=False)

    class Meta:
        db_table = "fornecedor_endereco"
        ordering = ["-padrao", "id"]
        verbose_name = "endereço do fornecedor"
        verbose_name_plural = "endereços do fornecedor"

    def save(self, *args, **kwargs):
        self.uf = self.uf.upper()
        super().save(*args, **kwargs)


class ContatoFornecedor(models.Model):
    """Aba Contatos."""

    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name="contatos")
    nome = models.CharField("nome", max_length=300)
    cargo = models.CharField("cargo", max_length=150, blank=True)
    telefone = models.CharField("telefone", max_length=15, blank=True)
    email = models.EmailField("email", max_length=254, blank=True)

    class Meta:
        db_table = "fornecedor_contato"
        ordering = ["id"]
        verbose_name = "contato do fornecedor"
        verbose_name_plural = "contatos do fornecedor"

    def save(self, *args, **kwargs):
        self.nome = normalizar_nome(self.nome) or ""
        super().save(*args, **kwargs)


class DadoBancarioFornecedor(models.Model):
    """Aba Dados bancários, tipo "Conta bancaria"."""

    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name="dados_bancarios")
    banco = models.ForeignKey("financeiro.Banco", verbose_name="banco", on_delete=models.PROTECT, related_name="+")
    agencia = models.CharField("agência", max_length=20, blank=True)
    agencia_digito = models.CharField("dígito da agência", max_length=20, blank=True)
    conta = models.CharField("conta", max_length=20, blank=True)
    conta_digito = models.CharField("dígito da conta", max_length=20, blank=True)

    class Meta:
        db_table = "fornecedor_dado_bancario"
        ordering = ["id"]
        verbose_name = "dado bancário do fornecedor"
        verbose_name_plural = "dados bancários do fornecedor"


class ChavePixFornecedor(models.Model):
    """Aba Dados bancários, tipo "Chave Pix" (PixTypeList da MarketUP)."""

    class Tipo(models.IntegerChoices):
        CPF = 1, "CPF"
        CNPJ = 2, "CNPJ"
        EMAIL = 3, "Email"
        CELULAR = 4, "Celular"
        ALEATORIA = 5, "Chave aleatória"

    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name="chaves_pix")
    tipo = models.PositiveSmallIntegerField("tipo da chave", choices=Tipo)
    chave = models.CharField("chave Pix", max_length=100)

    class Meta:
        db_table = "fornecedor_chave_pix"
        ordering = ["id"]
        verbose_name = "chave Pix do fornecedor"
        verbose_name_plural = "chaves Pix do fornecedor"


class DocumentoFornecedor(models.Model):
    """Aba Documentos: tipo (os mesmos tipos de documento do cliente), número/descrição e anexo opcional."""

    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.CASCADE, related_name="documentos")
    tipo = models.ForeignKey("clientes.TipoDocumento", verbose_name="tipo", on_delete=models.PROTECT, related_name="+")
    documento = models.CharField("documento", max_length=300)
    arquivo = models.FileField("anexo", upload_to="fornecedores/documentos/", blank=True)

    class Meta:
        db_table = "fornecedor_documento"
        ordering = ["id"]
        verbose_name = "documento do fornecedor"
        verbose_name_plural = "documentos do fornecedor"


# ---- Pedido de compra (purchase_order) ----


class EnderecoCopia(models.Model):
    """Os dois endereços do pedido são cópias gravadas nele (como a MarketUP): faturamento e entrega da empresa ou outro local."""

    fat_cep = models.CharField("CEP (faturamento)", max_length=9, blank=True)
    fat_logradouro = models.CharField("endereço (faturamento)", max_length=150, blank=True)
    fat_numero = models.CharField("nº (faturamento)", max_length=20, blank=True)
    fat_complemento = models.CharField("complemento (faturamento)", max_length=150, blank=True)
    fat_bairro = models.CharField("bairro (faturamento)", max_length=80, blank=True)
    fat_cidade = models.CharField("cidade (faturamento)", max_length=80, blank=True)
    fat_uf = models.CharField("UF (faturamento)", max_length=2, blank=True)
    fat_ibge = models.CharField("IBGE (faturamento)", max_length=7, blank=True)
    ent_cep = models.CharField("CEP (entrega)", max_length=9, blank=True)
    ent_logradouro = models.CharField("endereço (entrega)", max_length=150, blank=True)
    ent_numero = models.CharField("nº (entrega)", max_length=20, blank=True)
    ent_complemento = models.CharField("complemento (entrega)", max_length=150, blank=True)
    ent_bairro = models.CharField("bairro (entrega)", max_length=80, blank=True)
    ent_cidade = models.CharField("cidade (entrega)", max_length=80, blank=True)
    ent_uf = models.CharField("UF (entrega)", max_length=2, blank=True)
    ent_ibge = models.CharField("IBGE (entrega)", max_length=7, blank=True)

    class Meta:
        abstract = True


class PedidoCompra(ModeloBase, EnderecoCopia):
    """
    Pedido de compra. ID = PurchaseOrderID. Status com os números da MarketUP (PurchaseOrderStatusEnum: 1 Novo, 2 Faturado,
    6 Finalizado, 7 Cancelado). Recebimento e pagamento não são gravados: saem dos itens e das contas a pagar (como a MarketUP).
    """

    class Status(models.IntegerChoices):
        NOVO = 1, "Novo"
        FATURADO = 2, "Faturado"
        FINALIZADO = 6, "Finalizado"
        CANCELADO = 7, "Cancelado"

    status = models.PositiveSmallIntegerField("status", choices=Status, default=Status.NOVO)
    fornecedor = models.ForeignKey(Fornecedor, verbose_name="fornecedor", on_delete=models.PROTECT, related_name="pedidos_compra")
    comprador = models.ForeignKey(
        "usuarios.Funcionario", verbose_name="comprador", on_delete=models.PROTECT, null=True, blank=True, related_name="pedidos_compra"
    )
    emissao = models.DateField("emissão")
    previsao = models.DateField("recebimento (previsto)", null=True, blank=True)
    data_faturamento = models.DateTimeField("faturado em", null=True, blank=True)
    data_cancelamento = models.DateTimeField("cancelado em", null=True, blank=True)
    observacao = models.TextField("comentários", blank=True)
    sem_endereco_faturamento = models.BooleanField("sem endereço de faturamento", default=False)
    sem_endereco_entrega = models.BooleanField("sem endereço de entrega", default=False)

    subtotal = models.DecimalField("subtotal", max_digits=14, decimal_places=2, default=0)
    desconto = models.DecimalField("desconto geral (R$)", max_digits=14, decimal_places=2, default=0)
    desconto_percentual = models.DecimalField("desconto geral (%)", max_digits=7, decimal_places=4, default=0)
    desconto_em_percentual = models.BooleanField("desconto digitado em %", default=False)
    frete = models.DecimalField("frete", max_digits=14, decimal_places=2, default=0)
    outros_custos = models.DecimalField("outros custos", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("total", max_digits=14, decimal_places=2, default=0)

    conta_gerencial = models.ForeignKey(
        "financeiro.ContaGerencial", verbose_name="conta gerencial", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    nota_numero = models.CharField("nº NF-e", max_length=20, blank=True)
    nota_serie = models.CharField("série", max_length=5, blank=True)
    nota_emissao = models.DateField("emissão da NF-e", null=True, blank=True)
    # Orçamento de compra de origem (PurchaseBudgetID). Número solto: na carga, o orçamento pode vir depois.
    orcamento_id = models.BigIntegerField("orçamento de compra", null=True, blank=True)

    class Meta:
        db_table = "pedido_compra"
        ordering = ["-id"]
        verbose_name = "pedido de compra"
        verbose_name_plural = "pedidos de compra"
        indexes = [models.Index(fields=["status"]), models.Index(fields=["emissao"])]

    def __str__(self):
        return f"Pedido de compra {self.id}"


class ItemPedidoCompra(models.Model):
    """Item do pedido (PurchaseOrderItem). ID = PurchaseOrderItemID. `recebido`/`devolvido` = Received/Returned."""

    pedido = models.ForeignKey(PedidoCompra, on_delete=models.CASCADE, related_name="itens")
    produto = models.ForeignKey("catalogo.Produto", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    servico = models.ForeignKey("catalogo.Servico", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    descricao = models.CharField("descrição", max_length=300)
    unidade = models.ForeignKey("catalogo.Unidade", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    codigo_fornecedor = models.CharField("código do fornecedor", max_length=60, blank=True)
    quantidade = models.DecimalField("quantidade", max_digits=14, decimal_places=3)
    valor_unitario = models.DecimalField("unitário (custo)", max_digits=14, decimal_places=2)
    desconto = models.DecimalField("desconto (R$)", max_digits=14, decimal_places=2, default=0)
    desconto_percentual = models.DecimalField("desconto (%)", max_digits=7, decimal_places=4, default=0)
    desconto_em_percentual = models.BooleanField("desconto digitado em %", default=False)
    subtotal = models.DecimalField("subtotal", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("total", max_digits=14, decimal_places=2, default=0)
    recebido = models.DecimalField("recebido", max_digits=14, decimal_places=3, default=0)
    devolvido = models.DecimalField("devolvido", max_digits=14, decimal_places=3, default=0)
    data_devolucao = models.DateField("devolvido em", null=True, blank=True)
    valor_devolvido = models.DecimalField("valor devolvido", max_digits=14, decimal_places=2, default=0)
    lote = models.CharField("lote", max_length=40, blank=True)
    validade = models.DateField("validade", null=True, blank=True)
    observacao = models.CharField("observação", max_length=500, blank=True)
    ordem = models.PositiveIntegerField("ordem", default=0)

    class Meta:
        db_table = "pedido_compra_item"
        ordering = ["ordem", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(produto__isnull=False, servico__isnull=True) | models.Q(produto__isnull=True, servico__isnull=False),
                name="pedido_compra_item_produto_ou_servico",
            )
        ]
        verbose_name = "item do pedido de compra"
        verbose_name_plural = "itens do pedido de compra"


class ParcelaPedidoCompra(models.Model):
    """Parcela (PurchaseOrderInstallment). ID = PurchaseOrderInstallmentID. Ao concluir, vira uma conta a pagar (EventID)."""

    pedido = models.ForeignKey(PedidoCompra, on_delete=models.CASCADE, related_name="parcelas")
    numero = models.PositiveSmallIntegerField("parcela")
    quantidade = models.PositiveSmallIntegerField("de")
    vencimento = models.DateField("vencimento")
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    descricao = models.CharField("descrição (duplicata)", max_length=300, blank=True)
    grupo = models.CharField("grupo do pagamento", max_length=40, blank=True)
    # Forma −1 da MarketUP ("IMPORTADO XML") fica vazia.
    tipo_pagamento = models.ForeignKey("financeiro.TipoPagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    condicao_pagamento = models.ForeignKey("financeiro.CondicaoPagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    conta_gerencial = models.ForeignKey("financeiro.ContaGerencial", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    # Carga da MarketUP: EventID da conta a pagar, saldo e último pagamento. Valem só até a conta a pagar ser carregada
    # (a carga do financeiro liga ContaPagar.parcela_compra por este EventID).
    evento_marketup = models.BigIntegerField("EventID (MarketUP)", null=True, blank=True, db_index=True)
    saldo_marketup = models.DecimalField("saldo (MarketUP)", max_digits=14, decimal_places=2, null=True, blank=True)
    pago_em_marketup = models.DateField("último pagamento (MarketUP)", null=True, blank=True)

    class Meta:
        db_table = "pedido_compra_parcela"
        ordering = ["vencimento", "numero", "id"]
        verbose_name = "parcela do pedido de compra"
        verbose_name_plural = "parcelas do pedido de compra"


class DevolucaoCompra(ModeloBase):
    """Devolução / troca do pedido de compra (lista Compras › Devoluções): o valor devolvido abate o saldo; o excedente vira estorno."""

    pedido = models.ForeignKey(PedidoCompra, on_delete=models.PROTECT, related_name="devolucoes")
    data = models.DateField("data")
    valor_devolvido = models.DecimalField("valor devolvido", max_digits=14, decimal_places=2, default=0)
    valor_abatido = models.DecimalField("abatido do saldo", max_digits=14, decimal_places=2, default=0)
    valor_estorno = models.DecimalField("valor estornado", max_digits=14, decimal_places=2, default=0)
    tipo_pagamento = models.ForeignKey("financeiro.TipoPagamento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    conta_corrente = models.ForeignKey("financeiro.ContaCorrente", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    local = models.ForeignKey("estoque.LocalEstoque", on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "devolucao_compra"
        ordering = ["-data", "-id"]
        verbose_name = "devolução de compra"
        verbose_name_plural = "devoluções de compra"


class ItemDevolucaoCompra(models.Model):
    devolucao = models.ForeignKey(DevolucaoCompra, on_delete=models.CASCADE, related_name="itens")
    item = models.ForeignKey(ItemPedidoCompra, on_delete=models.PROTECT, related_name="devolucoes")
    devolver = models.DecimalField("devolver", max_digits=14, decimal_places=3, default=0)
    trocar = models.DecimalField("trocar", max_digits=14, decimal_places=3, default=0)
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = "devolucao_compra_item"
        verbose_name = "item devolvido"
        verbose_name_plural = "itens devolvidos"
