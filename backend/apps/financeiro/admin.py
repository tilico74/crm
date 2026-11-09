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



from .models import ContaReceber, LancamentoCaixa, Recebimento  # noqa: E402


class RecebimentoInline(TabularInline):
    model = Recebimento
    extra = 0
    fk_name = "conta"


@admin.register(ContaReceber)
class ContaReceberAdmin(ModelAdmin):
    list_display = ["id", "descricao", "parcela", "parcelas", "cliente", "vencimento", "valor", "saldo", "cancelada"]
    list_filter = ["origem", "cancelada"]
    search_fields = ["descricao", "cliente__nome", "origem_id"]
    inlines = [RecebimentoInline]


@admin.register(LancamentoCaixa)
class LancamentoCaixaAdmin(ModelAdmin):
    list_display = ["id", "data", "credito", "valor", "descricao", "conta_corrente"]
    list_filter = ["credito", "conta_corrente"]


from .models import ContaPagar  # noqa: E402


@admin.register(ContaPagar)
class ContaPagarAdmin(ModelAdmin):
    list_display = ["id", "descricao", "funcionario", "vencimento", "valor", "saldo", "cancelada"]
    list_filter = ["origem", "cancelada"]
