from django.db import models

from apps.core.documentos import validar_cnpj, validar_cpf
from apps.core.models import ModeloBase
from apps.core.normalizacao import normalizar_nome

# Vendas › Clientes da MarketUP (context/marketup/telas-e-entidades.md, "Clientes em detalhe").
# IDs = os da MarketUP: ClientID ("Código Sistema" da exportação), ClientTypeID, DocumentTypeID.


class TipoValor(models.TextChoices):
    """Botões R$ / % ao lado dos descontos da lista de preços."""

    REAIS = "R", "R$"
    PERCENTUAL = "P", "%"


class ListaPreco(ModeloBase):
    """Lista de preços / Tipo de cliente (client_type). ID 1 = Padrão."""

    nome = models.CharField("descrição", max_length=300)
    desconto_varejo = models.DecimalField("desc. varejo", max_digits=12, decimal_places=2, default=0)
    desconto_varejo_tipo = models.CharField("tipo do desc. varejo", max_length=1, choices=TipoValor, default=TipoValor.REAIS)
    desconto_atacado = models.DecimalField("desc. atacado", max_digits=12, decimal_places=2, default=0)
    desconto_atacado_tipo = models.CharField("tipo do desc. atacado", max_length=1, choices=TipoValor, default=TipoValor.REAIS)

    class Meta:
        db_table = "lista_preco"
        ordering = ["nome"]
        verbose_name = "lista de preços"
        verbose_name_plural = "listas de preços"

    def __str__(self):
        return self.nome


class ItemListaPreco(models.Model):
    """"Itens com desconto diferenciado": produto ou serviço com desconto próprio na lista."""

    lista = models.ForeignKey(ListaPreco, on_delete=models.CASCADE, related_name="itens")
    produto = models.ForeignKey("catalogo.Produto", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    servico = models.ForeignKey("catalogo.Servico", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    desconto_varejo = models.DecimalField("desconto varejo", max_digits=12, decimal_places=2, default=0)
    desconto_varejo_tipo = models.CharField(max_length=1, choices=TipoValor, default=TipoValor.REAIS)
    desconto_atacado = models.DecimalField("desconto atacado", max_digits=12, decimal_places=2, default=0)
    desconto_atacado_tipo = models.CharField(max_length=1, choices=TipoValor, default=TipoValor.REAIS)

    class Meta:
        db_table = "lista_preco_item"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(produto__isnull=False, servico__isnull=True) | models.Q(produto__isnull=True, servico__isnull=False),
                name="lista_preco_item_produto_ou_servico",
            )
        ]
        verbose_name = "item com desconto diferenciado"
        verbose_name_plural = "itens com desconto diferenciado"


class TipoDocumento(ModeloBase):
    """Tipo de documento do cliente (CNAE, Inscrição Estadual, Suframa…); IDs da MarketUP."""

    nome = models.CharField("nome", max_length=300)

    class Meta:
        db_table = "tipo_documento"
        ordering = ["nome"]
        verbose_name = "tipo de documento"
        verbose_name_plural = "tipos de documento"

    def __str__(self):
        return self.nome


class Cliente(ModeloBase):
    """
    Cliente com os campos e a ordem da ficha da MarketUP. ID = ClientID.

    Como na MarketUP, `nome` é o Nome (física) ou a Razão Social (jurídica) e
    `apelido` é o Apelido ou o Nome Fantasia (OfficialName / Name).
    """

    class TipoPessoa(models.TextChoices):
        FISICA = "F", "Física"
        JURIDICA = "J", "Jurídica"

    class Sexo(models.TextChoices):
        MASCULINO = "M", "Masculino"
        FEMININO = "F", "Feminino"

    class IndicadorIE(models.IntegerChoices):
        # Valores da MarketUP (IcmsContributorTypeID). Na NF-e: 1, 2 e 9.
        CONTRIBUINTE = 1, "Contribuinte do ICMS"
        ISENTO = 2, "Contribuinte Isento de Inscrição"
        NAO_CONTRIBUINTE = 3, "Não Contribuinte"

    # Ficha cadastral
    tipo_pessoa = models.CharField("pessoa física ou jurídica", max_length=1, choices=TipoPessoa, default=TipoPessoa.FISICA)
    lista_preco = models.ForeignKey(
        ListaPreco, verbose_name="tipo (lista de preços)", on_delete=models.PROTECT, default=1, related_name="clientes"
    )
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
    indicador_ie = models.PositiveSmallIntegerField(
        "indicador da IE do destinatário", choices=IndicadorIE, default=IndicadorIE.NAO_CONTRIBUINTE
    )
    inscricao_estadual = models.CharField("inscrição estadual", max_length=20, blank=True)
    inscricao_municipal = models.CharField("inscrição municipal", max_length=20, blank=True)
    telefone = models.CharField("telefone", max_length=15, blank=True)
    celular = models.CharField("celular", max_length=15, blank=True)
    email = models.EmailField("email", max_length=254, blank=True)
    site = models.CharField("site", max_length=64, blank=True)
    observacao = models.CharField("observação", max_length=300, blank=True)
    limite_credito = models.DecimalField("limite de crédito", max_digits=12, decimal_places=2, default=0)

    # Dados fiscais
    email_nfe = models.EmailField("email do destinatário da NFe", max_length=254, blank=True)
    iss_retido = models.BooleanField("ISS retido na fonte?", default=False)
    consumidor_final = models.BooleanField("consumidor final?", default=False)
    produtor_rural = models.BooleanField("produtor rural?", default=False)

    class Meta:
        db_table = "cliente"
        ordering = ["nome"]
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
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


class EnderecoCliente(models.Model):
    """Aba Endereços: vários por cliente, um padrão."""

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="enderecos")
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
        db_table = "cliente_endereco"
        ordering = ["-padrao", "id"]
        verbose_name = "endereço do cliente"
        verbose_name_plural = "endereços do cliente"

    def save(self, *args, **kwargs):
        self.uf = self.uf.upper()
        super().save(*args, **kwargs)


class ContatoCliente(models.Model):
    """Aba Contatos."""

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="contatos")
    nome = models.CharField("nome", max_length=300)
    cargo = models.CharField("cargo", max_length=150, blank=True)
    telefone = models.CharField("telefone", max_length=15, blank=True)
    email = models.EmailField("email", max_length=254, blank=True)

    class Meta:
        db_table = "cliente_contato"
        ordering = ["id"]
        verbose_name = "contato do cliente"
        verbose_name_plural = "contatos do cliente"

    def save(self, *args, **kwargs):
        self.nome = normalizar_nome(self.nome) or ""
        super().save(*args, **kwargs)


class DadoBancarioCliente(models.Model):
    """Aba Dados bancários."""

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="dados_bancarios")
    banco = models.ForeignKey("financeiro.Banco", verbose_name="banco", on_delete=models.PROTECT, related_name="+")
    agencia = models.CharField("agência", max_length=20, blank=True)
    agencia_digito = models.CharField("dígito da agência", max_length=20, blank=True)
    conta = models.CharField("conta", max_length=20, blank=True)
    conta_digito = models.CharField("dígito da conta", max_length=20, blank=True)

    class Meta:
        db_table = "cliente_dado_bancario"
        ordering = ["id"]
        verbose_name = "dado bancário do cliente"
        verbose_name_plural = "dados bancários do cliente"


class DocumentoCliente(models.Model):
    """Aba Documentos: tipo, número/descrição e anexo opcional."""

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="documentos")
    tipo = models.ForeignKey(TipoDocumento, verbose_name="tipo", on_delete=models.PROTECT, related_name="+")
    documento = models.CharField("documento", max_length=300)
    arquivo = models.FileField("anexo", upload_to="clientes/documentos/", blank=True)

    class Meta:
        db_table = "cliente_documento"
        ordering = ["id"]
        verbose_name = "documento do cliente"
        verbose_name_plural = "documentos do cliente"


class HistoricoCliente(models.Model):
    """Aba Histórico: anotações e, mais tarde, orçamentos e pedidos (T2xx)."""

    class Status(models.IntegerChoices):
        PENDENTE = 1, "Pendente"
        CONCLUIDO = 2, "Concluído"

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="historico")
    data = models.DateField("data")
    descricao = models.CharField("descrição", max_length=300)
    status = models.PositiveSmallIntegerField("status", choices=Status, default=Status.PENDENTE)

    class Meta:
        db_table = "cliente_historico"
        ordering = ["-data", "-id"]
        verbose_name = "histórico do cliente"
        verbose_name_plural = "histórico do cliente"
