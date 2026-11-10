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
