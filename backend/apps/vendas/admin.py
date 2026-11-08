from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ParametrosVenda


@admin.register(ParametrosVenda)
class ParametrosVendaAdmin(ModelAdmin):
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]
