"""API de comissões (T205): lançamentos (/comissoes) e aprovação (/fechamentos-comissao)."""

from datetime import date
from decimal import Decimal

from django.db.models import Q
from rest_framework import filters, mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet, PermissaoFuncionalidade
from apps.financeiro.models import ContaPagar
from apps.vendas.models import Pedido

from . import regras
from .models import Comissao, FechamentoComissao


def _data(valor, campo):
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError({campo: "Data inválida. Use AAAA-MM-DD."})


class ComissaoSerializer(serializers.ModelSerializer):
    vendedor_nome = serializers.CharField(source="vendedor.nome", read_only=True)
    pedido_cliente = serializers.CharField(source="pedido.cliente.nome", default=None, read_only=True)
    data_fechamento = serializers.DateField(source="fechamento.data", default=None, read_only=True)
    tipo_nome = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Comissao
        fields = [
            "id", "tipo", "tipo_nome", "vendedor", "vendedor_nome", "pedido", "pedido_cliente", "emissao", "fechamento", "data_fechamento",
            "estorno_de", "observacao", "valor_venda", "percentual", "valor", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["tipo", "fechamento", "estorno_de", "criado_em", "atualizado_em"]
        extra_kwargs = {"valor": {"required": False}, "percentual": {"required": False}}

    def validate(self, attrs):
        if self.instance and self.instance.fechamento_id:
            raise serializers.ValidationError({"detail": "Lançamento já fechado não pode ser alterado."})
        if self.instance:
            # Como na MarketUP: comissionado e data só no lançamento novo.
            for campo in ("vendedor", "emissao"):
                if campo in attrs and attrs[campo] != getattr(self.instance, campo):
                    raise serializers.ValidationError({campo: "Não muda depois de lançado."})
        venda = attrs.get("valor_venda", getattr(self.instance, "valor_venda", None))
        if venda is None or venda <= 0:
            raise serializers.ValidationError({"valor_venda": "Informe o valor da venda."})
        # Digitou o %: calcula a comissão. Digitou só a comissão: recalcula o % (commissionValueChange).
        if "percentual" in attrs:
            attrs["valor"] = regras.calcular(venda, attrs["percentual"])
        elif "valor" in attrs:
            attrs["percentual"] = (attrs["valor"] / venda * 100).quantize(Decimal("0.01")) if attrs["valor"] > 0 else Decimal(0)
        valor = attrs.get("valor", getattr(self.instance, "valor", Decimal(0)))
        if valor < 0:
            raise serializers.ValidationError({"valor": "A comissão não pode ser negativa."})
        if valor > venda:
            raise serializers.ValidationError({"valor": "O valor da comissão não pode ser superior ao valor da venda."})
        return attrs


class ComissaoViewSet(AuditoriaViewSet):
    """Vendas › Comissões (Lançamento de comissões)."""

    funcionalidade = "comissoes_lancamento"
    funcionalidades_leitura = ["comissoes_aprovacao"]
    serializer_class = ComissaoSerializer
    queryset = Comissao.objects.select_related("vendedor", "pedido__cliente", "fechamento")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["vendedor__nome", "=pedido__id", "pedido__cliente__nome", "observacao"]
    ordering_fields = ["emissao", "id", "valor"]

    def get_queryset(self):
        queryset = super().get_queryset()
        p = self.request.query_params
        if p.get("vendedor"):
            queryset = queryset.filter(vendedor_id=p["vendedor"])
        if p.get("fechada") in ("true", "false"):
            queryset = queryset.filter(fechamento__isnull=p["fechada"] == "false")
        if p.get("fechamento"):
            queryset = queryset.filter(fechamento_id=p["fechamento"])
        if p.get("emissao_de"):
            queryset = queryset.filter(emissao__gte=_data(p["emissao_de"], "emissao_de"))
        if p.get("emissao_ate"):
            queryset = queryset.filter(emissao__lte=_data(p["emissao_ate"], "emissao_ate"))
        return queryset

    def perform_create(self, serializer):
        serializer.save(tipo=Comissao.Tipo.MANUAL, criado_por=self.request.user, atualizado_por=self.request.user)

    def perform_destroy(self, instance):
        if instance.fechamento_id:
            raise ValidationError({"detail": "Lançamento já fechado não pode ser excluído. Desfaça o fechamento antes."})
        instance.delete()

    @action(detail=False, methods=["get"])
    def vendedores(self, request):
        """Comissionados: funcionários vendedores, com o % de cada um."""
        from apps.usuarios.models import Funcionario

        return Response(list(Funcionario.objects.filter(vendedor=True).order_by("nome").values("id", "nome", "comissao", "bloqueado")))

    @action(detail=False, methods=["get"])
    def pedidos(self, request):
        """Busca de pedido do lançamento manual: pedidos concluídos, com a base da comissão (total sem frete)."""
        termo = (request.query_params.get("search") or "").strip()
        consulta = Pedido.objects.filter(status__in=[Pedido.Status.FATURADO, Pedido.Status.FINALIZADO]).select_related("cliente", "vendedor")
        if termo:
            filtro = Q(cliente__nome__icontains=termo)
            if termo.isdigit():
                filtro |= Q(pk=int(termo))
            consulta = consulta.filter(filtro)
        return Response([
            {
                "id": p.id, "cliente": p.cliente.nome if p.cliente else "", "valor": f"{regras.base_do_pedido(p):.2f}",
                "vendedor": p.vendedor_id, "percentual": f"{p.vendedor.comissao:.2f}" if p.vendedor else "0.00",
            }
            for p in consulta.order_by("-id")[:8]
        ])


class FechamentoSerializer(serializers.ModelSerializer):
    comissoes = ComissaoSerializer(many=True, read_only=True)
    contas_pagar = serializers.SerializerMethodField()

    class Meta:
        model = FechamentoComissao
        fields = ["id", "data", "descricao", "valor_total", "comissoes", "contas_pagar", "criado_em", "criado_por"]

    def get_contas_pagar(self, fechamento):
        return list(
            ContaPagar.objects.filter(origem=ContaPagar.Origem.COMISSAO, origem_id=fechamento.id)
            .values("id", "descricao", "valor", "saldo", "vencimento", "cancelada", "funcionario__nome")
        )


class NovoFechamentoSerializer(serializers.Serializer):
    data = serializers.DateField()
    descricao = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    comissoes = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class FechamentoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Aprovação de comissões: só quem tem a permissão (o gerente) fecha; o fechamento gera as contas a pagar."""

    funcionalidade = "comissoes_aprovacao"
    permission_classes = [PermissaoFuncionalidade]
    serializer_class = FechamentoSerializer
    queryset = FechamentoComissao.objects.prefetch_related("comissoes__vendedor", "comissoes__pedido__cliente")

    def create(self, request):
        dados = NovoFechamentoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        fechamento = regras.fechar(dados.validated_data["comissoes"], dados.validated_data["data"], dados.validated_data["descricao"], request.user)
        return Response(FechamentoSerializer(self.get_queryset().get(pk=fechamento.pk)).data, status=201)

    def perform_destroy(self, instance):
        regras.desfazer(instance, self.request.user)
