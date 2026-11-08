from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ParametrosVenda


@admin.register(ParametrosVenda)
class ParametrosVendaAdmin(ModelAdmin):
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


from unfold.admin import TabularInline  # noqa: E402

from .models import ItemOrcamento, Orcamento, ParcelaOrcamento  # noqa: E402


class ItemOrcamentoInline(TabularInline):
    model = ItemOrcamento
    extra = 0


class ParcelaOrcamentoInline(TabularInline):
    model = ParcelaOrcamento
    extra = 0


@admin.register(Orcamento)
class OrcamentoAdmin(ModelAdmin):
    list_display = ["id", "status", "cliente", "emissao", "total"]
    list_filter = ["status"]
    search_fields = ["id", "cliente__nome"]
    readonly_fields = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]
    inlines = [ItemOrcamentoInline, ParcelaOrcamentoInline]
