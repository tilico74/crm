from django.db import transaction
from rest_framework import serializers

from apps.core.documentos import CnpjField, CpfField, RgField, TelefoneField

from .models import ACOES, Funcionalidade, Funcionario, Grupo, PermissaoGrupo, Usuario


class GrupoSerializer(serializers.ModelSerializer):
    usuarios = serializers.IntegerField(source="usuarios.count", read_only=True)

    class Meta:
        model = Grupo
        fields = ["id", "nome", "ativo", "usuarios"]


class FuncionalidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Funcionalidade
        fields = ["id", "codigo", "modulo", "nome", "ordem"]


class PermissaoGrupoSerializer(serializers.ModelSerializer):
    funcionalidade = serializers.SlugRelatedField(slug_field="codigo", queryset=Funcionalidade.objects.all())

    class Meta:
        model = PermissaoGrupo
        fields = ["funcionalidade", *ACOES]


class FuncionarioSerializer(serializers.ModelSerializer):
    """
    Ficha do funcionário com o acesso embutido, como no formulário da MarketUP:
    login, senha e grupo gravam no Usuario ligado ao funcionário.
    """

    cpf = CpfField()
    rg = RgField()
    cnpj = CnpjField()
    telefone = TelefoneField()
    celular = TelefoneField()

    login = serializers.CharField(source="usuario.username", default="", allow_blank=True)
    senha = serializers.CharField(write_only=True, required=False, allow_blank=True, style={"input_type": "password"})
    grupo = serializers.PrimaryKeyRelatedField(
        source="usuario.grupo", queryset=Grupo.objects.all(), required=False, allow_null=True
    )
    grupo_nome = serializers.CharField(source="usuario.grupo.nome", default=None, read_only=True)

    class Meta:
        model = Funcionario
        fields = [
            "id", "tipo_pessoa", "codigo", "terceiro", "bloqueado",
            "nome", "apelido", "cpf", "rg", "rg_emissor", "rg_uf", "sexo", "aniversario",
            "razao_social", "nome_fantasia", "cnpj", "inscricao_estadual", "inscricao_municipal",
            "telefone", "celular", "email", "site", "observacao",
            "login", "senha", "grupo", "grupo_nome", "comprador", "vendedor", "comissao",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        acesso = attrs.get("usuario", {})
        login = acesso.get("username")
        if login:
            outros = Usuario.objects.filter(username=login)
            if self.instance and self.instance.usuario_id:
                outros = outros.exclude(pk=self.instance.usuario_id)
            if outros.exists():
                raise serializers.ValidationError({"login": "Este login já está em uso."})
            if not (self.instance and self.instance.usuario_id) and not attrs.get("senha"):
                raise serializers.ValidationError({"senha": "Informe a senha do novo login."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        acesso = validated_data.pop("usuario", {})
        senha = validated_data.pop("senha", "")
        funcionario = super().create(validated_data)
        self._salvar_acesso(funcionario, acesso, senha)
        return funcionario

    @transaction.atomic
    def update(self, instance, validated_data):
        acesso = validated_data.pop("usuario", {})
        senha = validated_data.pop("senha", "")
        funcionario = super().update(instance, validated_data)
        self._salvar_acesso(funcionario, acesso, senha)
        return funcionario

    def _salvar_acesso(self, funcionario, acesso, senha):
        login = acesso.get("username")
        usuario = funcionario.usuario
        if not usuario and not login:
            return  # funcionário sem acesso ao sistema
        if not usuario:
            usuario = Usuario(username=login)
        if login:
            usuario.username = login
        if "grupo" in acesso:
            usuario.grupo = acesso["grupo"]
        if senha:
            usuario.set_password(senha)
        usuario.first_name = funcionario.nome[:150]
        usuario.email = funcionario.email
        usuario.is_active = not funcionario.bloqueado
        usuario.save()
        if funcionario.usuario_id != usuario.pk:
            funcionario.usuario = usuario
            funcionario.save(update_fields=["usuario"])


class MeSerializer(serializers.ModelSerializer):
    """Quem está logado: nome para a barra superior e permissões para menu e botões."""

    nome = serializers.SerializerMethodField()
    grupo = serializers.CharField(source="grupo.nome", default=None)
    permissoes = serializers.DictField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "username", "nome", "grupo", "is_superuser", "permissoes"]

    def get_nome(self, usuario):
        funcionario = getattr(usuario, "funcionario", None)
        return funcionario.nome if funcionario else (usuario.get_full_name() or usuario.username)
