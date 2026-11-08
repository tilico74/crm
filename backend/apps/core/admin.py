from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Empresa, EnderecoEmpresa


class EnderecoEmpresaInline(TabularInline):
    model = EnderecoEmpresa
    extra = 0


@admin.register(Empresa)
class EmpresaAdmin(ModelAdmin):
    list_display = ["nome_fantasia", "razao_social", "cnpj"]
    inlines = [EnderecoEmpresaInline]
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]
