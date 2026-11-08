from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Categoria, Marca, Subcategoria, Unidade

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
