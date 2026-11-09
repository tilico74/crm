from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Comissao, FechamentoComissao


@admin.register(Comissao)
class ComissaoAdmin(ModelAdmin):
    list_display = ["id", "emissao", "vendedor", "pedido", "valor_venda", "percentual", "valor", "fechamento"]
    list_filter = ["tipo", "vendedor"]
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


@admin.register(FechamentoComissao)
class FechamentoComissaoAdmin(ModelAdmin):
    list_display = ["id", "data", "descricao", "valor_total"]
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]
