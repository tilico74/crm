from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Categoria, ComposicaoProduto, Marca, Produto, Servico, Subcategoria, Unidade

AUDITORIA = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


@admin.register(Unidade)
class UnidadeAdmin(ModelAdmin):
    list_display = ["id", "sigla", "nome", "sistema"]
    readonly_fields = AUDITORIA


@admin.register(Marca)
class MarcaAdmin(ModelAdmin):
    list_display = ["id", "nome"]
    search_fields = ["nome"]
    readonly_fields = AUDITORIA


class SubcategoriaInline(TabularInline):
    model = Subcategoria
    fields = ["nome"]
    extra = 0


@admin.register(Categoria)
class CategoriaAdmin(ModelAdmin):
    list_display = ["id", "nome"]
    inlines = [SubcategoriaInline]
    readonly_fields = AUDITORIA


class ComposicaoInline(TabularInline):
    model = ComposicaoProduto
    fk_name = "kit"
    extra = 0
    autocomplete_fields = ["item"]


@admin.register(Produto)
class ProdutoAdmin(ModelAdmin):
    list_display = ["id", "descricao", "preco_venda", "categoria", "subcategoria", "ncm", "ativo"]
    list_filter = ["ativo", "tipo_item", "categoria"]
    search_fields = ["descricao", "codigo_barras", "codigo_interno"]
    inlines = [ComposicaoInline]
    readonly_fields = AUDITORIA


@admin.register(Servico)
class ServicoAdmin(ModelAdmin):
    list_display = ["id", "nome", "unidade", "preco_venda", "ativo"]
    search_fields = ["nome", "codigo_barras"]
    readonly_fields = AUDITORIA
