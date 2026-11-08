from django.conf import settings
from django.db import models

from .documentos import validar_cnpj


class ModeloBase(models.Model):
    """Campos de auditoria de toda tabela (context/03-modelo-de-dados.md)."""

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="criado por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="atualizado por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        abstract = True


class Empresa(ModeloBase):
    """Informações da empresa (Ajustes › Empresa). Registro único: id = 1."""

    AREAS = [
        "Mercados, empórios e padarias",
        "Casa, construção e jardinagem",
        "Informática, games e eletrônicos",
        "Comércio varejista ou especializado",
        "Roupas, calçados e acessórios",
        "Perfumarias e farmácias",
        "Veterinárias e pet shops",
        "Salões de beleza, clínicas e spa",
        "Bares, restaurantes e lanchonetes",
        "Bancas, quiosques e papelarias",
        "Oficinas mecânicas e técnicas",
        "Prestadores de serviços e MEIs",
    ]
    FUSOS = [
        ("America/Noronha", "Fernando de Noronha (UTC-2)"),
        ("America/Sao_Paulo", "Brasília (UTC-3)"),
        ("America/Manaus", "Amazonas (UTC-4)"),
        ("America/Rio_Branco", "Acre (UTC-5)"),
    ]

    cnpj = models.CharField("CNPJ", max_length=18, blank=True, validators=[validar_cnpj])
    nome_fantasia = models.CharField("nome fantasia", max_length=150, blank=True)
    razao_social = models.CharField("razão social", max_length=150, blank=True)
    email = models.EmailField("e-mail", blank=True)
    telefone = models.CharField("telefone", max_length=20, blank=True)
    whatsapp = models.CharField("WhatsApp", max_length=20, blank=True)
    area_atuacao = models.CharField("área de atuação", max_length=60, choices=[(a, a) for a in AREAS], blank=True)
    inscricao_estadual = models.CharField("inscrição estadual", max_length=20, blank=True)
    inscricao_municipal = models.CharField("inscrição municipal", max_length=20, blank=True)
    logotipo = models.FileField("logotipo", upload_to="empresa/", blank=True)
    fuso_horario = models.CharField("fuso horário", max_length=40, choices=FUSOS, default="America/Sao_Paulo")
    horario_verao = models.BooleanField("ajustar horário de verão automaticamente?", default=False)
    produtor_rural = models.BooleanField("produtor rural?", default=False)

    class Meta:
        db_table = "empresa"
        verbose_name = "empresa"
        verbose_name_plural = "empresa"

    def __str__(self):
        return self.nome_fantasia or self.razao_social or "Empresa"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def atual(cls) -> "Empresa":
        return cls.objects.get_or_create(pk=1)[0]


class EnderecoEmpresa(models.Model):
    """Endereços da empresa: faturamento, entregas e correspondências (MarketUP)."""

    class Tipo(models.TextChoices):
        FATURAMENTO = "faturamento", "Faturamento"
        ENTREGAS = "entregas", "Entregas"
        CORRESPONDENCIAS = "correspondencias", "Correspondências"

    empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name="enderecos")
    tipo = models.CharField("tipo", max_length=20, choices=Tipo)
    cep = models.CharField("CEP", max_length=9, blank=True)
    logradouro = models.CharField("endereço", max_length=150, blank=True)
    numero = models.CharField("nº", max_length=20, blank=True)
    complemento = models.CharField("complemento", max_length=80, blank=True)
    bairro = models.CharField("bairro", max_length=80, blank=True)
    cidade = models.CharField("cidade", max_length=80, blank=True)
    uf = models.CharField("UF", max_length=2, blank=True)
    ibge = models.CharField("código IBGE do município", max_length=7, blank=True)

    class Meta:
        db_table = "empresa_endereco"
        constraints = [models.UniqueConstraint(fields=["empresa", "tipo"], name="empresa_endereco_tipo_unico")]
        verbose_name = "endereço da empresa"
        verbose_name_plural = "endereços da empresa"

    def save(self, *args, **kwargs):
        self.uf = self.uf.upper()
        super().save(*args, **kwargs)
