"""API de orçamentos de venda (T202)."""

import uuid
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet
from apps.financeiro.models import CondicaoPagamento
from apps.usuarios.models import Funcionario

from .calculo import gerar_parcelas
from .models import Orcamento, ParametrosVenda
from .serializers import OrcamentoListaSerializer, OrcamentoSerializer


def _data(valor: str | None, campo: str) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError({campo: "Data inválida. Use AAAA-MM-DD."})


class OrcamentoViewSet(AuditoriaViewSet):
    funcionalidade = "orcamentos"
    queryset = Orcamento.objects.select_related("cliente", "vendedor")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["=id", "cliente__nome", "cliente__apelido"]
    ordering_fields = ["id", "emissao", "total"]

    def get_serializer_class(self):
        return OrcamentoListaSerializer if self.action == "list" else OrcamentoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            queryset = queryset.prefetch_related(
                "itens__unidade", "itens__produto", "itens__servico", "parcelas__tipo_pagamento", "parcelas__condicao_pagamento"
            )
        # Filtros da MarketUP: Status, Cliente, Data de emissão, de pedido e de validade, Produtos, Valor.
        p = self.request.query_params
        if p.get("status"):
            queryset = queryset.filter(status__in=p["status"].split(","))
        if p.get("cliente"):
            queryset = queryset.filter(Q(cliente__nome__icontains=p["cliente"]) | Q(cliente__apelido__icontains=p["cliente"]))
        for campo, coluna in (("emissao", "emissao"), ("validade", "validade"), ("pedido", "data_pedido__date")):
            if p.get(f"{campo}_de"):
                queryset = queryset.filter(**{f"{coluna}__gte": _data(p[f"{campo}_de"], f"{campo}_de")})
            if p.get(f"{campo}_ate"):
                queryset = queryset.filter(**{f"{coluna}__lte": _data(p[f"{campo}_ate"], f"{campo}_ate")})
        if p.get("produto"):
            queryset = queryset.filter(itens__descricao__icontains=p["produto"]).distinct()
        if p.get("valor_de"):
            queryset = queryset.filter(total__gte=p["valor_de"])
        if p.get("valor_ate"):
            queryset = queryset.filter(total__lte=p["valor_ate"])
        return queryset

    def perform_destroy(self, instance):
        if instance.status != Orcamento.Status.NOVO:
            raise ValidationError({"detail": "Só orçamento Novo pode ser excluído. Use Cancelar."})
        instance.delete()

    @action(detail=False, methods=["get"])
    def novo(self, request):
        """Valores iniciais da ficha: emissão hoje, validade e entrega pelos Parâmetros de venda, vendedor = quem está logado."""
        parametros = ParametrosVenda.atual()
        hoje = timezone.localdate()
        vendedor = Funcionario.objects.filter(usuario=request.user, vendedor=True).values_list("id", flat=True).first()
        return Response({
            "emissao": hoje,
            "validade": hoje + timedelta(days=parametros.venda_validade_orcamento),
            "entrega": hoje + timedelta(days=parametros.venda_entrega_orcamento),
            "vendedor": vendedor,
        })

    @action(detail=False, methods=["get"])
    def vendedores(self, request):
        """Funcionários marcados como vendedor (campo Vendedor da ficha)."""
        return Response(list(Funcionario.objects.filter(vendedor=True, bloqueado=False).order_by("nome").values("id", "nome", "comissao")))

    @action(detail=False, methods=["get"], url_path="gerar-parcelas")
    def gerar_parcelas(self, request):
        """"Gerar contas": parcelas da condição de pagamento para o valor informado (não grava; vai com o Salvar)."""
        p = request.query_params
        condicao = CondicaoPagamento.objects.select_related("tipo").filter(pk=p.get("condicao")).first()
        if not condicao:
            raise ValidationError({"condicao": "Escolha o parcelamento."})
        try:
            valor = round(float(p.get("valor", "0")), 2)
        except ValueError:
            raise ValidationError({"valor": "Valor inválido."})
        if valor <= 0:
            raise ValidationError({"valor": "O valor do recebimento não pode ser 0."})
        # Como na MarketUP, a 1ª parcela conta a partir de hoje (dia em que as contas são geradas).
        base = _data(p.get("base"), "base") or timezone.localdate()
        parcelas = gerar_parcelas(valor, condicao.parcelas, base, condicao.primeira_parcela, condicao.intervalo)
        grupo = uuid.uuid4().hex[:12]  # PaymentGuid: junta as parcelas deste "Gerar contas"
        return Response([
            {
                "numero": x.numero, "quantidade": x.quantidade, "vencimento": x.vencimento, "valor": f"{x.valor:.2f}", "descricao": "", "grupo": grupo,
                "tipo_pagamento": condicao.tipo_id, "tipo_pagamento_nome": condicao.tipo.descricao,
                "condicao_pagamento": condicao.id, "condicao_pagamento_nome": condicao.descricao,
            }
            for x in parcelas
        ])

    @action(detail=True, methods=["patch"])
    def cancelar(self, request, pk=None):
        orcamento = self.get_object()
        if orcamento.status != Orcamento.Status.NOVO:
            raise ValidationError({"detail": f"Orçamento {orcamento.get_status_display().lower()} não pode ser cancelado."})
        orcamento.status = Orcamento.Status.CANCELADO
        orcamento.data_cancelamento = timezone.now()
        orcamento.atualizado_por = request.user
        orcamento.save()
        return Response(OrcamentoSerializer(orcamento, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def copiar(self, request, pk=None):
        """Ícone "copiar" da MarketUP: novo orçamento com os mesmos cliente e itens, datas de hoje e sem parcelas."""
        original = self.get_object()
        parametros = ParametrosVenda.atual()
        hoje = timezone.localdate()
        itens = list(original.itens.all())
        copia = Orcamento.objects.get(pk=original.pk)
        copia.pk = None
        copia.status = Orcamento.Status.NOVO
        copia.emissao = hoje
        copia.validade = hoje + timedelta(days=parametros.venda_validade_orcamento)
        copia.entrega = hoje + timedelta(days=parametros.venda_entrega_orcamento)
        copia.data_pedido = copia.data_cancelamento = copia.pedido_id = None
        copia.criado_por = copia.atualizado_por = request.user
        copia.save()
        for item in itens:
            item.pk = None
            item.orcamento = copia
        copia.itens.model.objects.bulk_create(itens)
        return Response(OrcamentoSerializer(copia, context={"request": request}).data, status=201)
