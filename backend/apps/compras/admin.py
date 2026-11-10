from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import (
    ChavePixFornecedor,
    ContatoFornecedor,
    DadoBancarioFornecedor,
    DocumentoFornecedor,
    EnderecoFornecedor,
    Fornecedor,
    TipoFornecedor,
)

AUDITORIA = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


@admin.register(TipoFornecedor)
class TipoFornecedorAdmin(ModelAdmin):
    list_display = ["id", "nome"]
    readonly_fields = AUDITORIA


class EnderecoInline(TabularInline):
    model = EnderecoFornecedor
    extra = 0


class ContatoInline(TabularInline):
    model = ContatoFornecedor
    extra = 0


class DadoBancarioInline(TabularInline):
    model = DadoBancarioFornecedor
    extra = 0


class ChavePixInline(TabularInline):
    model = ChavePixFornecedor
    extra = 0


class DocumentoInline(TabularInline):
    model = DocumentoFornecedor
    extra = 0


@admin.register(Fornecedor)
class FornecedorAdmin(ModelAdmin):
    list_display = ["id", "nome", "tipo", "cnpj", "cpf", "telefone", "email", "bloqueado"]
    list_filter = ["tipo", "bloqueado", "transportadora"]
    search_fields = ["nome", "apelido", "cnpj", "cpf"]
    readonly_fields = AUDITORIA
    inlines = [EnderecoInline, ContatoInline, DadoBancarioInline, ChavePixInline, DocumentoInline]
