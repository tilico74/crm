from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Banco, CondicaoPagamento, ContaCorrente, ContaGerencial, TipoPagamento

AUDITORIA = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


@admin.register(ContaGerencial)
class ContaGerencialAdmin(ModelAdmin):
    list_display = ["codigo_referencia", "nome", "tipo", "classificacao_dre", "ativo", "sistema"]
    list_filter = ["tipo", "classificacao_dre", "ativo", "sistema"]
    search_fields = ["nome", "codigo_referencia"]
    readonly_fields = AUDITORIA


@admin.register(Banco)
class BancoAdmin(ModelAdmin):
    list_display = ["codigo", "nome"]
    search_fields = ["codigo", "nome"]
    readonly_fields = AUDITORIA


@admin.register(ContaCorrente)
class ContaCorrenteAdmin(ModelAdmin):
    list_display = ["nome", "interna", "banco", "agencia", "conta", "principal", "ativo"]
    list_filter = ["interna", "principal", "ativo"]
    search_fields = ["nome"]
    readonly_fields = AUDITORIA


class CondicaoPagamentoInline(TabularInline):
    model = CondicaoPagamento
    extra = 0
    exclude = AUDITORIA


@admin.register(TipoPagamento)
class TipoPagamentoAdmin(ModelAdmin):
    list_display = ["descricao", "ativo"]
    list_filter = ["ativo"]
    search_fields = ["descricao"]
    readonly_fields = AUDITORIA
    inlines = [CondicaoPagamentoInline]
