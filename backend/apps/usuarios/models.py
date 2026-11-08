from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import ModeloBase
from apps.core.documentos import validar_cnpj, validar_cpf
from apps.core.normalizacao import normalizar_nome

# Modelo da MarketUP (context/marketup/telas-e-entidades.md, seção Ajustes):
# o usuário fica dentro do funcionário, e cada usuário tem um grupo (perfil) com
# uma matriz de permissões funcionalidade × acessar/adicionar/alterar/excluir.

ACOES = ("acessar", "adicionar", "alterar", "excluir")


class Grupo(ModeloBase):
    """Perfil de acesso (ex.: Administrador, Vendedor, Técnico)."""

    nome = models.CharField("nome", max_length=80, unique=True)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        db_table = "grupo"
        ordering = ["nome"]
        verbose_name = "grupo"
        verbose_name_plural = "grupos"

    def __str__(self):
        return self.nome


class Funcionalidade(models.Model):
    """Item da matriz de permissões, como na tela Permissões da MarketUP."""

    codigo = models.SlugField("código", max_length=60, unique=True)
    modulo = models.CharField("módulo", max_length=40)
    nome = models.CharField("nome", max_length=80)
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        db_table = "funcionalidade"
        ordering = ["ordem"]
        verbose_name = "funcionalidade"
        verbose_name_plural = "funcionalidades"

    def __str__(self):
        return f"{self.modulo} › {self.nome}"


class PermissaoGrupo(models.Model):
    grupo = models.ForeignKey(Grupo, on_delete=models.CASCADE, related_name="permissoes")
    funcionalidade = models.ForeignKey(Funcionalidade, on_delete=models.CASCADE, related_name="+")
    acessar = models.BooleanField("acessar", default=False)
    adicionar = models.BooleanField("adicionar", default=False)
    alterar = models.BooleanField("alterar", default=False)
    excluir = models.BooleanField("excluir", default=False)

    class Meta:
        db_table = "permissao_grupo"
        constraints = [
            models.UniqueConstraint(fields=["grupo", "funcionalidade"], name="permissao_grupo_unica"),
        ]
        verbose_name = "permissão"
        verbose_name_plural = "permissões"


class Usuario(AbstractUser):
    """Login do sistema. O cadastro da pessoa fica em Funcionario."""

    grupo = models.ForeignKey(
        Grupo, verbose_name="grupo", on_delete=models.PROTECT, null=True, blank=True, related_name="usuarios"
    )

    class Meta:
        db_table = "usuario"
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def pode(self, funcionalidade: str, acao: str) -> bool:
        if not self.is_active:
            return False
        if self.is_superuser:
            return True
        if acao not in ACOES or not (self.grupo_id and self.grupo.ativo):
            return False
        return PermissaoGrupo.objects.filter(
            grupo_id=self.grupo_id, funcionalidade__codigo=funcionalidade, **{acao: True}
        ).exists()

    def permissoes(self) -> dict[str, list[str]]:
        """Mapa funcionalidade → ações permitidas, para o front-end montar menu e botões."""
        if self.is_superuser:
            return {codigo: list(ACOES) for codigo in Funcionalidade.objects.values_list("codigo", flat=True)}
        if not (self.grupo_id and self.grupo.ativo):
            return {}
        mapa = {}
        for p in PermissaoGrupo.objects.filter(grupo_id=self.grupo_id).select_related("funcionalidade"):
            acoes = [a for a in ACOES if getattr(p, a)]
            if acoes:
                mapa[p.funcionalidade.codigo] = acoes
        return mapa


class Funcionario(ModeloBase):
    """Funcionário, com os campos e a ordem da ficha da MarketUP. ID = EmployeeID."""

    class TipoPessoa(models.TextChoices):
        FISICA = "F", "Física"
        JURIDICA = "J", "Jurídica"

    class Sexo(models.TextChoices):
        MASCULINO = "M", "Masculino"
        FEMININO = "F", "Feminino"

    # Ficha cadastral
    tipo_pessoa = models.CharField("pessoa física ou jurídica", max_length=1, choices=TipoPessoa, default=TipoPessoa.FISICA)
    codigo = models.CharField("código", max_length=30, blank=True)
    terceiro = models.BooleanField("terceiro", default=False)
    bloqueado = models.BooleanField("bloqueado", default=False)
    nome = models.CharField("nome", max_length=150)
    apelido = models.CharField("apelido", max_length=80, blank=True)
    cpf = models.CharField("CPF", max_length=14, blank=True, validators=[validar_cpf])
    rg = models.CharField("RG", max_length=20, blank=True)
    rg_emissor = models.CharField("emissor", max_length=20, blank=True)
    rg_uf = models.CharField("UF", max_length=2, blank=True)
    sexo = models.CharField("sexo", max_length=1, choices=Sexo, blank=True)
    aniversario = models.DateField("aniversário", null=True, blank=True)
    razao_social = models.CharField("razão social", max_length=150, blank=True)
    nome_fantasia = models.CharField("nome fantasia", max_length=150, blank=True)
    cnpj = models.CharField("CNPJ", max_length=18, blank=True, validators=[validar_cnpj])
    inscricao_estadual = models.CharField("inscrição estadual", max_length=20, blank=True)
    inscricao_municipal = models.CharField("inscrição municipal", max_length=20, blank=True)
    telefone = models.CharField("telefone", max_length=20, blank=True)
    celular = models.CharField("celular", max_length=20, blank=True)
    email = models.EmailField("email", blank=True)
    site = models.CharField("site", max_length=150, blank=True)
    observacao = models.TextField("observação", blank=True)

    # Acesso e funções (login, senha e grupo ficam no Usuario)
    usuario = models.OneToOneField(
        Usuario, verbose_name="usuário", on_delete=models.SET_NULL, null=True, blank=True, related_name="funcionario"
    )
    comprador = models.BooleanField("comprador?", default=False)
    vendedor = models.BooleanField("vendedor?", default=False)
    comissao = models.DecimalField("comissão (%)", max_digits=5, decimal_places=2, default=0)

    class Meta:
        db_table = "funcionario"
        ordering = ["nome"]
        verbose_name = "funcionário"
        verbose_name_plural = "funcionários"

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        # Só nome de pessoa é padronizado (ADR-007); razão social e nome fantasia ficam como digitados.
        for campo in ("nome", "apelido"):
            setattr(self, campo, normalizar_nome(getattr(self, campo)) or "")
        super().save(*args, **kwargs)
