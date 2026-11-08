from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import (
    Cliente,
    ContatoCliente,
    DadoBancarioCliente,
    DocumentoCliente,
    EnderecoCliente,
    HistoricoCliente,
    ItemListaPreco,
    ListaPreco,
    TipoDocumento,
)

AUDITORIA = ["criado_em", "criado_por", "atualizado_em", "atualizado_por"]


class ItemListaPrecoInline(TabularInline):
    model = ItemListaPreco
    extra = 0
    autocomplete_fields = []


@admin.register(ListaPreco)
class ListaPrecoAdmin(ModelAdmin):
    list_display = ["id", "nome", "desconto_varejo", "desconto_atacado"]
    readonly_fields = AUDITORIA
    inlines = [ItemListaPrecoInline]


@admin.register(TipoDocumento)
class TipoDocumentoAdmin(ModelAdmin):
    list_display = ["id", "nome"]
    readonly_fields = AUDITORIA


class EnderecoInline(TabularInline):
    model = EnderecoCliente
    extra = 0


class ContatoInline(TabularInline):
    model = ContatoCliente
    extra = 0


class DadoBancarioInline(TabularInline):
    model = DadoBancarioCliente
    extra = 0


class DocumentoInline(TabularInline):
    model = DocumentoCliente
    extra = 0


class HistoricoInline(TabularInline):
    model = HistoricoCliente
    extra = 0


@admin.register(Cliente)
class ClienteAdmin(ModelAdmin):
    list_display = ["id", "nome", "lista_preco", "telefone", "celular", "email", "bloqueado"]
    list_filter = ["tipo_pessoa", "bloqueado", "lista_preco"]
    search_fields = ["nome", "apelido", "cpf", "cnpj", "email"]
    readonly_fields = AUDITORIA
    inlines = [EnderecoInline, ContatoInline, DadoBancarioInline, DocumentoInline, HistoricoInline]
