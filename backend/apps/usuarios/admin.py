from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import Funcionalidade, Funcionario, Grupo, PermissaoGrupo, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    list_display = ["username", "first_name", "grupo", "is_active", "is_superuser"]
    list_filter = ["grupo", "is_active", "is_superuser"]
    fieldsets = [*UserAdmin.fieldsets, ("Grupo", {"fields": ["grupo"]})]


class PermissaoGrupoInline(TabularInline):
    model = PermissaoGrupo
    extra = 0


@admin.register(Grupo)
class GrupoAdmin(ModelAdmin):
    list_display = ["nome", "ativo"]
    inlines = [PermissaoGrupoInline]


@admin.register(Funcionalidade)
class FuncionalidadeAdmin(ModelAdmin):
    list_display = ["modulo", "nome", "codigo", "ordem"]
    list_filter = ["modulo"]


@admin.register(Funcionario)
class FuncionarioAdmin(ModelAdmin):
    list_display = ["nome", "codigo", "telefone", "celular", "email", "vendedor", "bloqueado"]
    list_filter = ["vendedor", "bloqueado", "terceiro"]
    search_fields = ["nome", "apelido", "codigo", "cpf", "email"]
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]
