"""API do estoque (T301): tipos, locais (com estoque atual e inventários), motivos, movimentações e consulta."""

from decimal import Decimal

from django.db.models import ProtectedError, Q, Sum
from rest_framework import filters, mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalogo.models import Produto, Unidade
from apps.core.api import AuditoriaViewSet, PermissaoFuncionalidade

from . import regras
from .models import Inventario, ItemMovimentacao, LocalEstoque, MotivoMovimentacao, Movimentacao, Saldo, TipoEstocagem

LEITURA_ESTOQUE = ["consulta_estoque", "movimentacoes_estoque", "locais_estoque", "pedidos"]


class TipoEstocagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoEstocagem
        fields = ["id", "nome", "sistema"]
        read_only_fields = ["sistema"]


class TipoEstocagemViewSet(AuditoriaViewSet):
    funcionalidade = "tipos_estocagem"
    funcionalidades_leitura = ["locais_estoque"]
    queryset = TipoEstocagem.objects.all()
    serializer_class = TipoEstocagemSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def perform_destroy(self, instance):
        if instance.sistema:
            raise ValidationError({"detail": "Tipo do sistema não pode ser excluído."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Há locais com este tipo de estocagem."})


class MotivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoMovimentacao
        fields = ["id", "nome"]


class MotivoViewSet(AuditoriaViewSet):
    funcionalidade = "motivos_movimentacao"
    funcionalidades_leitura = ["movimentacoes_estoque"]
    queryset = MotivoMovimentacao.objects.all()
    serializer_class = MotivoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_permissions(self):
        # Cadastro rápido na movimentação (como a MarketUP): quem lança movimentação pode criar motivo.
        if self.action == "create" and self.request.user.is_authenticated and self.request.user.pode("movimentacoes_estoque", "adicionar"):
            return []
        return super().get_permissions()

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Motivo já usado em movimentação."})


class LocalSerializer(serializers.ModelSerializer):
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)
    em_inventario = serializers.SerializerMethodField()

    class Meta:
        model = LocalEstoque
        fields = ["id", "nome", "tipo", "tipo_nome", "ativo", "padrao", "sistema", "em_inventario"]
        read_only_fields = ["sistema"]

    def get_em_inventario(self, local):
        return Inventario.objects.filter(local=local, status=Inventario.Status.ABERTO).values_list("id", flat=True).first()


class LocalViewSet(AuditoriaViewSet):
    funcionalidade = "locais_estoque"
    funcionalidades_leitura = LEITURA_ESTOQUE
    queryset = LocalEstoque.objects.select_related("tipo")
    serializer_class = LocalSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def perform_save(self, serializer):
        local = serializer.save(atualizado_por=self.request.user)
        if local.padrao:
            LocalEstoque.objects.exclude(pk=local.pk).update(padrao=False)

    def perform_create(self, serializer):
        local = serializer.save(criado_por=self.request.user, atualizado_por=self.request.user)
        if local.padrao:
            LocalEstoque.objects.exclude(pk=local.pk).update(padrao=False)

    def perform_update(self, serializer):
        self.perform_save(serializer)

    def perform_destroy(self, instance):
        if instance.sistema:
            raise ValidationError({"detail": "O Estoque Padrão não pode ser excluído. Desmarque Ativo se não usa."})
        if Saldo.objects.filter(local=instance).exclude(quantidade=0).exists():
            raise ValidationError({"detail": "O local tem itens em estoque. Transfira antes de excluir."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O local já foi movimentado. Desmarque Ativo para escondê-lo."})

    @action(detail=True, methods=["get"])
    def estoque(self, request, pk=None):
        """Aba "Estoque atual": código, item e quantidade disponível no local."""
        local = self.get_object()
        termo = request.query_params.get("search", "").strip()
        saldos = Saldo.objects.filter(local=local).exclude(quantidade=0).select_related("produto__unidade")
        if termo:
            saldos = saldos.filter(Q(produto__descricao__icontains=termo) | Q(produto__codigo_barras__icontains=termo))
        return Response([
            {"produto": s.produto_id, "codigo": s.produto.codigo_barras, "descricao": s.produto.descricao,
             "unidade": s.produto.unidade.sigla if s.produto.unidade_id else "", "quantidade": f"{s.quantidade:.3f}"}
            for s in saldos.order_by("produto__descricao")[:500]
        ])

    @action(detail=True, methods=["get", "post"])
    def inventarios(self, request, pk=None):
        """Aba "Inventários": lista (GET) e "Inventariar estoque" (POST)."""
        local = self.get_object()
        if request.method == "POST":
            if not request.user.pode("locais_estoque", "alterar"):
                raise ValidationError({"detail": "Sem permissão para inventariar."})
            regras.iniciar_inventario(local, request.user)
        return Response([
            {"id": i.id, "status": i.status, "status_nome": i.get_status_display(), "inicio": i.inicio, "fim": i.fim, "movimentacao": i.movimentacao_id}
            for i in local.inventarios.all()
        ])


class InventarioView(APIView):
    """Inventário: GET itens (com o saldo atual) · POST {acao: concluir, contagens} ou {acao: cancelar}."""

    funcionalidade = "locais_estoque"
    permission_classes = [PermissaoFuncionalidade]

    def _inv(self, pk):
        inv = Inventario.objects.select_related("local").filter(pk=pk).first()
        if not inv:
            raise ValidationError({"detail": "Inventário não encontrado."})
        return inv

    def get(self, request, pk):
        inv = self._inv(pk)
        contados = {i.produto_id: i for i in inv.itens.all()}
        aberto = inv.status == Inventario.Status.ABERTO
        if aberto:
            # Em andamento: todos os produtos que movimentam estoque, com o saldo de agora.
            produtos = Produto.objects.filter(movimenta_estoque=True).select_related("unidade").order_by("descricao")
        else:
            # Concluído/cancelado: só os itens do inventário, com o saldo da hora da contagem (fotografia).
            produtos = Produto.objects.filter(pk__in=contados).select_related("unidade").order_by("descricao")

        def saldo_de(p):
            if not aberto and p.id in contados:
                return contados[p.id].quantidade_sistema
            return regras.saldo(p, inv.local)

        return Response({
            "id": inv.id, "local": inv.local_id, "local_nome": inv.local.nome, "status": inv.status, "status_nome": inv.get_status_display(),
            "inicio": inv.inicio, "fim": inv.fim, "movimentacao": inv.movimentacao_id,
            "itens": [
                {"produto": p.id, "codigo": p.codigo_barras, "descricao": p.descricao, "unidade": p.unidade.sigla if p.unidade_id else "",
                 "saldo": f"{saldo_de(p):.3f}",
                 "contado": f"{contados[p.id].quantidade_contada:.3f}" if p.id in contados and contados[p.id].quantidade_contada is not None else None}
                for p in produtos
            ],
        })

    def post(self, request, pk):
        inv = self._inv(pk)
        if request.data.get("acao") == "cancelar":
            regras.cancelar_inventario(inv, request.user)
        elif request.data.get("acao") == "concluir":
            contagens = {int(k): v for k, v in (request.data.get("contagens") or {}).items() if v not in (None, "")}
            regras.concluir_inventario(inv, contagens, request.user)
        else:
            raise ValidationError({"acao": "Use concluir ou cancelar."})
        return self.get(request, pk)


class ItemMovimentacaoSerializer(serializers.ModelSerializer):
    produto_descricao = serializers.CharField(source="produto.descricao", read_only=True)
    codigo = serializers.CharField(source="produto.codigo_barras", read_only=True)
    unidade_sigla = serializers.CharField(source="unidade.sigla", default=None, read_only=True)
    unidade = serializers.PrimaryKeyRelatedField(queryset=Unidade.objects.all(), required=False, allow_null=True)

    class Meta:
        model = ItemMovimentacao
        fields = ["id", "produto", "produto_descricao", "codigo", "unidade", "unidade_sigla", "quantidade", "valor_unitario", "lote", "fabricacao", "validade"]

    def validate_quantidade(self, q):
        if q <= 0:
            raise serializers.ValidationError("A quantidade tem que ser maior que zero.")
        return q


class MovimentacaoSerializer(serializers.ModelSerializer):
    itens = ItemMovimentacaoSerializer(many=True)
    tipo_nome = serializers.CharField(source="get_tipo_display", read_only=True)
    origem_nome = serializers.CharField(source="get_origem_display", default=None, read_only=True)
    local_origem_nome = serializers.CharField(source="local_origem.nome", default=None, read_only=True)
    local_destino_nome = serializers.CharField(source="local_destino.nome", default=None, read_only=True)
    motivo_nome = serializers.CharField(source="motivo.nome", default=None, read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id", "tipo", "tipo_nome", "origem", "origem_nome", "origem_id", "data", "local_origem", "local_origem_nome", "local_destino",
            "local_destino_nome", "pessoa", "informacoes", "nota_numero", "nota_serie", "nota_emissao", "nota_valor_adicional", "motivo",
            "motivo_nome", "perda_avaria", "total_quantidade", "total_valor", "manual", "itens", "criado_em",
        ]
        read_only_fields = ["origem", "origem_id", "total_quantidade", "total_valor", "manual", "criado_em"]

    def validate_tipo(self, tipo):
        if tipo == Movimentacao.Tipo.ACERTO:
            raise serializers.ValidationError("Escolha Entrada, Saída ou Transferência.")
        return tipo

    def create(self, validated_data):
        itens = validated_data.pop("itens")
        return regras.registrar(itens=itens, usuario=self.context["request"].user, **validated_data)


class MovimentacaoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Movimentações: manuais se lançam aqui; as automáticas vêm dos documentos. Não se alteram nem se excluem."""

    funcionalidade = "movimentacoes_estoque"
    funcionalidades_leitura = ["consulta_estoque", "locais_estoque"]
    permission_classes = [PermissaoFuncionalidade]
    serializer_class = MovimentacaoSerializer
    queryset = Movimentacao.objects.select_related("local_origem", "local_destino", "motivo").prefetch_related("itens__produto", "itens__unidade")
    filter_backends = [filters.SearchFilter]
    search_fields = ["pessoa", "informacoes", "itens__produto__descricao", "=origem_id", "nota_numero"]

    def get_queryset(self):
        q = super().get_queryset()
        p = self.request.query_params
        for campo in ("tipo", "origem"):
            if p.get(campo):
                q = q.filter(**{campo: p[campo]})
        if p.get("local"):
            q = q.filter(Q(local_origem_id=p["local"]) | Q(local_destino_id=p["local"]))
        if p.get("produto"):
            q = q.filter(itens__produto_id=p["produto"])
        if p.get("de"):
            q = q.filter(data__gte=p["de"])
        if p.get("ate"):
            q = q.filter(data__lte=p["ate"])
        return q.distinct()


class ConsultaView(APIView):
    """
    Consulta de estoque: produtos que movimentam estoque com qtd. disponível, estoque mínimo, preço, valor unitário (custo)
    e valor total; cada um abre por local. PATCH {produto, local, quantidade} = ajuste (acerto).
    """

    funcionalidade = "consulta_estoque"
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        p = request.query_params
        produtos = Produto.objects.filter(movimenta_estoque=True).select_related("unidade").prefetch_related("saldos__local")
        if p.get("search"):
            produtos = produtos.filter(Q(descricao__icontains=p["search"]) | Q(codigo_barras__icontains=p["search"]))
        linhas = []
        for prod in produtos.order_by("descricao"):
            locais = [s for s in prod.saldos.all() if s.quantidade != 0 or not p.get("com_saldo")]
            total = sum((s.quantidade for s in prod.saldos.all()), Decimal(0))
            if p.get("abaixo_minimo") and not (total < prod.estoque_minimo):
                continue
            custo = prod.preco_custo or Decimal(0)
            linhas.append({
                "produto": prod.id, "codigo": prod.codigo_barras, "descricao": prod.descricao, "unidade": prod.unidade.sigla if prod.unidade_id else "",
                "quantidade": f"{total:.3f}", "estoque_minimo": f"{prod.estoque_minimo:.3f}", "abaixo_minimo": total < prod.estoque_minimo,
                "preco": f"{prod.preco_venda:.2f}", "valor_unitario": f"{custo:.2f}", "valor_total": f"{(custo * total):.2f}",
                "locais": [{"local": s.local_id, "local_nome": s.local.nome, "quantidade": f"{s.quantidade:.3f}", "valor_total": f"{(custo * s.quantidade):.2f}"} for s in locais],
            })
        valor = sum((Decimal(x["valor_total"]) for x in linhas), Decimal(0))
        return Response({"count": len(linhas), "valor_total": f"{valor:.2f}", "results": linhas})

    def patch(self, request):
        produto = Produto.objects.filter(pk=request.data.get("produto"), movimenta_estoque=True).first()
        local = LocalEstoque.objects.filter(pk=request.data.get("local")).first()
        if not produto or not local:
            raise ValidationError({"detail": "Produto (que movimenta estoque) e local são obrigatórios."})
        try:
            quantidade = Decimal(str(request.data.get("quantidade")))
        except Exception:
            raise ValidationError({"quantidade": "Quantidade inválida."})
        regras.ajustar(produto, local, quantidade, request.user)
        return Response({"produto": produto.id, "local": local.id, "quantidade": f"{regras.saldo(produto, local):.3f}"})
