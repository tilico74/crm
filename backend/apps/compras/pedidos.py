"""
Pedido de compra (T301 etapa 3). Regras lidas no código da tela da MarketUP em 09/11/2026 (só leitura):
- saveCurrentOrder / validateInformations: datas, soma das parcelas, quantidade.
- calcTotals: subtotal = Σ total dos itens; total = subtotal − desconto geral + frete + outros custos.
- billCurrentOrder / doBill: "PEDIDO NÃO FATURADO!" + motivo; conta gerencial vazia vira 58; pergunta se atualiza o custo.
- PurchaseOrderReceiveController: receber (parcial) num local de estoque, com NF, lote e validade.
- showReturnModal / doReturn: devolver e trocar; o valor devolvido abate o saldo e o excedente é estornado.
- cancelOrder / doCancel: contas a pagar saem, o valor pago volta (estorno) e o recebido sai do estoque.
- getStatusClass / getDeliveryStatus / getFinancialStatus (ficha) e getList* (lista): status calculados, não gravados.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import filters, serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet
from apps.financeiro.models import CondicaoPagamento, ContaCorrente, ContaGerencial, ContaPagar, LancamentoCaixa, OrigemFinanceira, TipoPagamento
from apps.usuarios.models import Funcionario
from apps.vendas.calculo import calcular_item, calcular_orcamento, dinheiro, gerar_parcelas

from .models import DevolucaoCompra, ItemDevolucaoCompra, ItemPedidoCompra, ParcelaPedidoCompra, PedidoCompra

ZERO = Decimal(0)
CONTA_COMPRAS = 58  # "Mercadoria para Revenda": a MarketUP usa quando a parcela vem sem conta gerencial
NAO_FATURADO = "PEDIDO NÃO FATURADO! "
CAMPOS_ENDERECO = ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "ibge"]


def _data(valor, campo) -> date | None:
    if not valor:
        return None
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise ValidationError({campo: "Data inválida. Use AAAA-MM-DD."})


def comprador_logado(usuario) -> int | None:
    """Comprador padrão: o funcionário do usuário logado, se ele for comprador e não estiver bloqueado."""
    return Funcionario.objects.filter(usuario=usuario, comprador=True, bloqueado=False).values_list("id", flat=True).first()


def enderecos_da_empresa() -> dict:
    """Faturamento e entrega do pedido = endereços da própria empresa (Informações da empresa)."""
    from apps.core.models import Empresa

    empresa = Empresa.atual()
    dados = {}
    for prefixo, tipo in (("fat", "faturamento"), ("ent", "entregas")):
        e = empresa.enderecos.filter(tipo=tipo).first() or empresa.enderecos.first()
        for campo in CAMPOS_ENDERECO:
            dados[f"{prefixo}_{campo}"] = getattr(e, campo, "") if e else ""
    return dados


def contas_do_pedido(pedido_id):
    return ContaPagar.objects.filter(origem=OrigemFinanceira.COMPRAS, origem_id=pedido_id, cancelada=False)


def situacoes(pedido: PedidoCompra) -> dict:
    """
    Status calculados como na MarketUP:
    - ficha: faixa "Faturado" / "Concluído" (nada a receber e saldo < 0,001) / "Cancelado" / "Novo";
      Recebimento Total / Atrasado / Pendente / Parcial; Pagamento Total / Atrasado / Pendente / Parcial.
    - lista: Recebimento Cancelado / Pendente / Entregue / Atrasado (sem "parcial");
      Pagamento Cancelado / Pago / Pago Parcialmente / Pendente (sem "atrasado").
    """
    hoje = timezone.localdate()
    itens = [i for i in pedido.itens.all() if i.produto_id]
    itens_a_receber = sum(1 for i in itens if i.quantidade > i.recebido)
    nada_recebido = all(i.recebido <= 0 for i in itens)
    saldo, valor, vencida, todas_em_aberto = ZERO, ZERO, False, True
    for parcela in pedido.parcelas.all():
        contas = [c for c in parcela.contas.all() if not c.cancelada]
        c = contas[0] if contas else None
        s = c.saldo if c else (parcela.saldo_marketup if parcela.saldo_marketup is not None else parcela.valor)
        saldo += s
        valor += parcela.valor
        vencimento = c.vencimento if c else parcela.vencimento  # a conta a pagar pode ter o vencimento mudado no Financeiro
        vencida = vencida or (s >= Decimal("0.01") and vencimento < hoje)
        todas_em_aberto = todas_em_aberto and dinheiro(s) == dinheiro(parcela.valor)
    st = pedido.status
    faturado = st in (PedidoCompra.Status.FATURADO, PedidoCompra.Status.FINALIZADO)
    if st == PedidoCompra.Status.CANCELADO:
        faixa, receb, pag, receb_lista, pag_lista = "cancelado", "Cancelado", "Cancelado", "Cancelado", "Cancelado"
    else:
        faixa = ("concluido" if itens_a_receber < 1 and saldo < Decimal("0.001") else "faturado") if faturado else "novo"
        if itens_a_receber < 1:
            receb = "Total"
        elif pedido.previsao and pedido.previsao < hoje:
            receb = "Atrasado"
        elif nada_recebido:
            receb = "Pendente"
        else:
            receb = "Parcial"
        if saldo < Decimal("0.01"):
            pag = "Total"
        elif vencida:
            pag = "Atrasado"
        elif todas_em_aberto:
            pag = "Pendente"
        else:
            pag = "Parcial"
        if not faturado:
            receb_lista = pag_lista = "Pendente"
        else:
            receb_lista = "Entregue" if itens_a_receber <= 0 else ("Atrasado" if pedido.previsao and pedido.previsao < hoje else "Pendente")
            pag_lista = "Pago" if saldo < Decimal("0.01") else ("Pago Parcialmente" if saldo < valor else "Pendente")
    return {
        "situacao": faixa,
        "recebimento_status": receb,
        "pagamento_status": pag,
        "recebimento_lista": receb_lista,
        "pagamento_lista": pag_lista,
        "itens_a_receber": itens_a_receber,
        "saldo_pagar": f"{saldo:.2f}",
        "valor_pago": f"{max(valor - saldo, ZERO):.2f}" if faturado else "0.00",
    }


# ---- Serializers ----


class ItemPedidoCompraSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    unidade_sigla = serializers.CharField(source="unidade.sigla", default=None, read_only=True)
    codigo_barras = serializers.SerializerMethodField()
    custo_atual = serializers.SerializerMethodField()
    movimenta_estoque = serializers.SerializerMethodField()

    class Meta:
        model = ItemPedidoCompra
        fields = [
            "id", "produto", "servico", "descricao", "codigo_barras", "unidade", "unidade_sigla", "codigo_fornecedor", "quantidade",
            "valor_unitario", "desconto", "desconto_percentual", "desconto_em_percentual", "subtotal", "total", "recebido", "devolvido",
            "data_devolucao", "valor_devolvido", "lote", "validade", "observacao", "ordem", "custo_atual", "movimenta_estoque",
        ]
        read_only_fields = ["subtotal", "total", "recebido", "devolvido", "data_devolucao", "valor_devolvido"]
        extra_kwargs = {"descricao": {"required": False, "allow_blank": True}}

    def get_codigo_barras(self, item):
        catalogo = item.produto or item.servico
        return getattr(catalogo, "codigo_barras", "") if catalogo else ""

    def get_custo_atual(self, item):
        return f"{item.produto.preco_custo:.2f}" if item.produto_id else None

    def get_movimenta_estoque(self, item):
        return bool(item.produto_id and item.produto.movimenta_estoque)

    def validate(self, attrs):
        if bool(attrs.get("produto")) == bool(attrs.get("servico")):
            raise serializers.ValidationError("Escolha um produto ou um serviço.")
        if attrs["quantidade"] <= 0:
            raise serializers.ValidationError({"quantidade": "A quantidade tem que ser maior que zero."})
        if attrs["valor_unitario"] < 0:
            raise serializers.ValidationError({"valor_unitario": "O valor unitário não pode ser negativo."})
        catalogo = attrs.get("produto") or attrs.get("servico")
        if not attrs.get("descricao"):
            attrs["descricao"] = getattr(catalogo, "descricao", None) or getattr(catalogo, "nome", "")
        if not attrs.get("unidade"):
            attrs["unidade"] = catalogo.unidade
        return attrs


class ParcelaPedidoCompraSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", default=None, read_only=True)
    condicao_pagamento_nome = serializers.CharField(source="condicao_pagamento.descricao", default=None, read_only=True)
    conta_gerencial_nome = serializers.CharField(source="conta_gerencial.nome", default=None, read_only=True)
    saldo = serializers.SerializerMethodField()
    conta_pagar = serializers.SerializerMethodField()
    ultimo_pagamento = serializers.SerializerMethodField()

    class Meta:
        model = ParcelaPedidoCompra
        fields = [
            "id", "numero", "quantidade", "vencimento", "valor", "descricao", "grupo", "tipo_pagamento", "tipo_pagamento_nome",
            "condicao_pagamento", "condicao_pagamento_nome", "conta_gerencial", "conta_gerencial_nome", "saldo", "conta_pagar", "ultimo_pagamento",
        ]

    def validate_valor(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("Parcela com valor inválido: informe um valor maior que zero.")
        return valor

    def _conta(self, parcela):
        if not parcela.pk:
            return None
        contas = [c for c in parcela.contas.all() if not c.cancelada]
        return contas[0] if contas else None

    def get_saldo(self, parcela):
        conta = self._conta(parcela)
        if conta:
            return f"{conta.saldo:.2f}"
        return f"{(parcela.saldo_marketup if parcela.saldo_marketup is not None else parcela.valor):.2f}"

    def get_conta_pagar(self, parcela):
        conta = self._conta(parcela)
        return conta.id if conta else None

    def get_ultimo_pagamento(self, parcela):
        conta = self._conta(parcela)
        datas = [p.data for p in conta.pagamentos.all()] if conta else []
        return max(datas) if datas else parcela.pago_em_marketup


CAMPOS_PEDIDO = [
    "id", "status", "fornecedor", "fornecedor_nome", "fornecedor_documento", "fornecedor_ie", "fornecedor_email", "fornecedor_telefone",
    "comprador", "comprador_nome", "emissao", "previsao", "data_faturamento", "data_cancelamento", "observacao",
    "sem_endereco_faturamento", "sem_endereco_entrega",
    *[f"fat_{c}" for c in CAMPOS_ENDERECO], *[f"ent_{c}" for c in CAMPOS_ENDERECO],
    "subtotal", "desconto", "desconto_percentual", "desconto_em_percentual", "frete", "outros_custos", "total",
    "conta_gerencial", "conta_gerencial_nome", "nota_numero", "nota_serie", "nota_emissao", "orcamento_id",
    "itens", "parcelas", "criado_em", "atualizado_em",
]


class PedidoCompraSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", default=None, read_only=True)
    fornecedor_documento = serializers.SerializerMethodField()
    fornecedor_ie = serializers.CharField(source="fornecedor.inscricao_estadual", default=None, read_only=True)
    fornecedor_email = serializers.CharField(source="fornecedor.email", default=None, read_only=True)
    fornecedor_telefone = serializers.CharField(source="fornecedor.telefone", default=None, read_only=True)
    comprador_nome = serializers.CharField(source="comprador.nome", default=None, read_only=True)
    conta_gerencial_nome = serializers.CharField(source="conta_gerencial.nome", default=None, read_only=True)
    itens = ItemPedidoCompraSerializer(many=True, required=False)
    parcelas = ParcelaPedidoCompraSerializer(many=True, required=False)

    class Meta:
        model = PedidoCompra
        fields = CAMPOS_PEDIDO
        read_only_fields = ["status", "data_faturamento", "data_cancelamento", "subtotal", "total", "orcamento_id", "criado_em", "atualizado_em"]

    def get_fornecedor_documento(self, pedido):
        f = pedido.fornecedor
        return (f.cnpj or f.cpf) if f else ""

    def validate(self, attrs):
        if self.instance and self.instance.status != PedidoCompra.Status.NOVO:
            # Depois de concluído só os comentários mudam (o resto vem do Receber, Devolver e Cancelar).
            if set(attrs) - {"observacao"}:
                raise serializers.ValidationError(
                    {"detail": f"Pedido {self.instance.get_status_display().lower()} não pode ser alterado. Use Copiar para fazer outro."}
                )
            return attrs
        fornecedor = attrs.get("fornecedor", getattr(self.instance, "fornecedor", None))
        if fornecedor is None:
            raise serializers.ValidationError({"fornecedor": "Informe o fornecedor: digite o nome para localizá-lo ou use Cadastrar novo fornecedor."})
        if fornecedor.bloqueado and "fornecedor" in attrs:
            raise serializers.ValidationError({"fornecedor": "Fornecedor bloqueado. Desbloqueie na ficha do fornecedor para comprar dele."})
        emissao = attrs.get("emissao", getattr(self.instance, "emissao", None))
        previsao = attrs.get("previsao", getattr(self.instance, "previsao", None))
        # validIssueDate / validDeliveryDate: emissão até hoje; recebimento não antes da emissão.
        if not emissao or emissao > timezone.localdate() or (previsao and previsao < emissao):
            raise serializers.ValidationError({"emissao": "Data de entrega ou de emissão inválida!"})
        for campo in ("frete", "outros_custos", "desconto", "desconto_percentual"):
            if attrs.get(campo) is not None and attrs[campo] < 0:
                raise serializers.ValidationError({campo: "Não pode ser negativo."})

        itens = attrs.get("itens")
        if itens is not None:
            itens = [calcular_item(dict(i)) for i in itens]
            for n, item in enumerate(itens):
                if item["desconto"] > item["subtotal"]:
                    raise serializers.ValidationError({"itens": f"Item {n + 1}: o desconto é maior que o valor do item."})
            attrs["itens"] = itens
        else:
            itens = [{"total": i.total} for i in (self.instance.itens.all() if self.instance else [])]
        base = {c: attrs.get(c, getattr(self.instance, c, None)) for c in ("desconto", "desconto_percentual", "desconto_em_percentual", "frete", "outros_custos")}
        totais = calcular_orcamento(base, itens)
        if totais["desconto"] > totais["subtotal"]:
            raise serializers.ValidationError({"desconto": "O desconto é maior que o subtotal."})
        attrs.update(totais)

        parcelas = attrs.get("parcelas")
        if parcelas:
            soma = sum((dinheiro(p["valor"]) for p in parcelas), ZERO)
            if soma != totais["total"]:
                raise serializers.ValidationError({"parcelas": "O valor total das parcelas está diferente do valor total do pedido. Favor verificar!"})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        itens = validated_data.pop("itens", [])
        parcelas = validated_data.pop("parcelas", [])
        pedido = super().create(validated_data)
        self._gravar(pedido, itens, parcelas)
        return pedido

    @transaction.atomic
    def update(self, instance, validated_data):
        itens = validated_data.pop("itens", None)
        parcelas = validated_data.pop("parcelas", None)
        pedido = super().update(instance, validated_data)
        self._gravar(pedido, itens, parcelas)
        return pedido

    def _gravar(self, pedido, itens, parcelas):
        if itens is not None:
            pedido.itens.all().delete()
            ItemPedidoCompra.objects.bulk_create(
                ItemPedidoCompra(pedido=pedido, **{**{k: v for k, v in item.items() if k != "id"}, "ordem": n + 1}) for n, item in enumerate(itens)
            )
        if parcelas is not None:
            pedido.parcelas.all().delete()
            # Parcela sem conta gerencial leva a do pedido (setPayment); sem nenhuma, a 58 na conclusão.
            ParcelaPedidoCompra.objects.bulk_create(
                ParcelaPedidoCompra(pedido=pedido, **{**{k: v for k, v in p.items() if k != "id"}, "conta_gerencial": p.get("conta_gerencial") or pedido.conta_gerencial})
                for p in parcelas
            )

    def to_representation(self, pedido):
        return {**super().to_representation(pedido), **situacoes(pedido)}


class PedidoCompraListaSerializer(serializers.ModelSerializer):
    """Colunas da MarketUP: Pedido (nº + status) · Status (emitido / faturado em) · Fornecedor (nome, CNPJ, IE) · Recebimento · Valor."""

    fornecedor_nome = serializers.CharField(source="fornecedor.nome", default=None, read_only=True)
    fornecedor_documento = serializers.SerializerMethodField()
    fornecedor_ie = serializers.CharField(source="fornecedor.inscricao_estadual", default=None, read_only=True)

    class Meta:
        model = PedidoCompra
        fields = ["id", "status", "fornecedor", "fornecedor_nome", "fornecedor_documento", "fornecedor_ie", "emissao", "data_faturamento", "previsao", "total"]

    def get_fornecedor_documento(self, pedido):
        return pedido.fornecedor.cnpj or pedido.fornecedor.cpf

    def to_representation(self, pedido):
        return {**super().to_representation(pedido), **situacoes(pedido)}


class ReceberItemSerializer(serializers.Serializer):
    item = serializers.IntegerField()
    quantidade = serializers.DecimalField(max_digits=14, decimal_places=3)
    lote = serializers.CharField(required=False, allow_blank=True, max_length=40)
    validade = serializers.DateField(required=False, allow_null=True)


class ReceberSerializer(serializers.Serializer):
    local = serializers.IntegerField(required=False, allow_null=True)
    data = serializers.DateField(error_messages={"required": "Informe a data de recebimento.", "null": "Informe a data de recebimento."})
    nota_numero = serializers.CharField(required=False, allow_blank=True, max_length=20)
    nota_serie = serializers.CharField(required=False, allow_blank=True, max_length=5)
    nota_emissao = serializers.DateField(required=False, allow_null=True)
    observacao = serializers.CharField(required=False, allow_blank=True)
    itens = ReceberItemSerializer(many=True)


class DevolverItemSerializer(serializers.Serializer):
    item = serializers.IntegerField()
    devolver = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, default=ZERO)
    trocar = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, default=ZERO)


class DevolverSerializer(serializers.Serializer):
    data = serializers.DateField(required=False)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    conta_corrente = serializers.PrimaryKeyRelatedField(queryset=ContaCorrente.objects.all(), required=False, allow_null=True)
    local = serializers.IntegerField(required=False, allow_null=True)
    itens = DevolverItemSerializer(many=True)


class CancelarSerializer(serializers.Serializer):
    valor_estorno = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    data = serializers.DateField(required=False)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    conta_corrente = serializers.PrimaryKeyRelatedField(queryset=ContaCorrente.objects.all(), required=False, allow_null=True)
    local = serializers.IntegerField(required=False, allow_null=True)


def validar_conclusao(pedido: PedidoCompra) -> str | None:
    """billCurrentOrder: a primeira mensagem, na ordem da MarketUP (parcelas vencidas não bloqueiam)."""
    if not pedido.sem_endereco_faturamento and not pedido.fat_logradouro:
        return NAO_FATURADO + "Endereço de faturamento / cobrança não informado."
    if not pedido.sem_endereco_entrega and not pedido.ent_logradouro:
        return NAO_FATURADO + "Endereço de entrega não informado."
    if not pedido.itens.exists():
        return NAO_FATURADO + "Não há items no pedido."
    parcelas = list(pedido.parcelas.all())
    if not parcelas:
        return NAO_FATURADO + "Forma/Condição de pagamento inválida."
    if sum((p.valor for p in parcelas), ZERO) != pedido.total:
        return NAO_FATURADO + "Verifique o valor das parcelas, total inválido."
    return None


def _local(pk):
    from apps.estoque.models import LocalEstoque

    if pk:
        local = LocalEstoque.objects.filter(pk=pk, ativo=True).first()
        if not local:
            raise ValidationError({"local": "Local de estoque inválido."})
        return local
    return LocalEstoque.padrao_atual()


def _custo_unitario(item: ItemPedidoCompra) -> Decimal:
    """Custo de entrada do item no estoque: total do item ÷ quantidade (já com o desconto do item)."""
    return dinheiro(item.total / item.quantidade) if item.quantidade else item.valor_unitario


# ---- API ----


class PedidoCompraViewSet(AuditoriaViewSet):
    """Estoque › Compras › Pedidos (purchase_order)."""

    funcionalidade = "pedidos_compra"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["=id", "fornecedor__nome", "fornecedor__apelido", "fornecedor__cnpj"]
    ordering_fields = ["id", "emissao", "data_faturamento", "total"]

    def get_serializer_class(self):
        return PedidoCompraListaSerializer if self.action == "list" else PedidoCompraSerializer

    def get_queryset(self):
        queryset = PedidoCompra.objects.select_related("fornecedor", "comprador", "conta_gerencial").prefetch_related(
            "itens__produto", "parcelas__contas__pagamentos"
        )
        if self.action != "list":
            queryset = queryset.prefetch_related(
                "itens__unidade", "itens__servico", "parcelas__tipo_pagamento", "parcelas__condicao_pagamento", "parcelas__conta_gerencial"
            )
        p = self.request.query_params
        if p.get("status"):
            queryset = queryset.filter(status__in=p["status"].split(","))
        if p.get("fornecedor"):
            termo = p["fornecedor"]
            queryset = queryset.filter(Q(fornecedor__nome__icontains=termo) | Q(fornecedor__apelido__icontains=termo))
        for campo, coluna in (("emissao", "emissao"), ("faturamento", "data_faturamento__date"), ("previsao", "previsao")):
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
        if p.get("a_receber") == "1":
            # Compras em aberto: faturados com item ainda não recebido.
            from django.db.models import F

            queryset = queryset.filter(status=PedidoCompra.Status.FATURADO, itens__produto__isnull=False, itens__recebido__lt=F("itens__quantidade")).distinct()
        return queryset

    def perform_destroy(self, instance):
        if instance.status != PedidoCompra.Status.NOVO:
            raise ValidationError({"detail": "Só pedido Novo pode ser excluído. Use Cancelar."})
        instance.delete()

    def _dados(self, pk):
        return PedidoCompraSerializer(self.get_queryset().get(pk=pk), context={"request": self.request}).data

    @action(detail=False, methods=["get"])
    def novo(self, request):
        """Valores iniciais: emissão hoje, recebimento previsto daqui a 7 dias (como a MarketUP), comprador logado, endereços da empresa e conta 58."""
        hoje = timezone.localdate()
        conta = ContaGerencial.objects.filter(pk=CONTA_COMPRAS).first()
        return Response({
            "emissao": hoje, "previsao": hoje + timedelta(days=7), "comprador": comprador_logado(request.user),
            "conta_gerencial": conta.id if conta else None, "conta_gerencial_nome": conta.nome if conta else None,
            **enderecos_da_empresa(),
        })

    @action(detail=False, methods=["get"])
    def compradores(self, request):
        """Funcionários marcados como "Comprador?" (campo Comprador da ficha)."""
        return Response(list(Funcionario.objects.filter(comprador=True, bloqueado=False).order_by("nome").values("id", "nome")))

    @action(detail=False, methods=["get"], url_path="gerar-parcelas")
    def gerar_parcelas(self, request):
        """"Gerar contas" (setPayment): igual à venda; as parcelas levam a conta gerencial escolhida."""
        p = request.query_params
        condicao = CondicaoPagamento.objects.select_related("tipo").filter(pk=p.get("condicao")).first()
        if not condicao:
            raise ValidationError({"condicao": "Escolha o parcelamento."})
        try:
            valor = round(float(p.get("valor", "0")), 2)
        except ValueError:
            raise ValidationError({"valor": "Valor inválido."})
        if valor <= 0:
            raise ValidationError({"valor": "O valor do recebimento não pode ser 0"})
        conta = ContaGerencial.objects.filter(pk=p.get("conta_gerencial") or CONTA_COMPRAS).first()
        base = _data(p.get("base"), "base") or timezone.localdate()
        grupo = uuid.uuid4().hex[:12]
        return Response([
            {
                "numero": x.numero, "quantidade": x.quantidade, "vencimento": x.vencimento, "valor": f"{x.valor:.2f}", "descricao": "", "grupo": grupo,
                "tipo_pagamento": condicao.tipo_id, "tipo_pagamento_nome": condicao.tipo.descricao,
                "condicao_pagamento": condicao.id, "condicao_pagamento_nome": condicao.descricao,
                "conta_gerencial": conta.id if conta else None, "conta_gerencial_nome": conta.nome if conta else None,
            }
            for x in gerar_parcelas(valor, condicao.parcelas, base, condicao.primeira_parcela, condicao.intervalo)
        ])

    @action(detail=True, methods=["get"], url_path="custos")
    def custos(self, request, pk=None):
        """doBill: itens cujo valor é diferente do custo do produto (a tela pergunta se atualiza o custo)."""
        pedido = self.get_object()
        return Response([
            {"produto": i.produto_id, "descricao": i.produto.descricao, "de": f"{i.produto.preco_custo:.2f}", "para": f"{i.valor_unitario:.2f}"}
            for i in pedido.itens.all() if i.produto_id and i.valor_unitario != i.produto.preco_custo
        ])

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def concluir(self, request, pk=None):
        """"Concluir": confere, fatura, gera uma conta a pagar por parcela (origem 6) e, se pedido, atualiza o custo dos produtos."""
        pedido = self.get_object()
        if pedido.status != PedidoCompra.Status.NOVO:
            raise ValidationError({"detail": f"Pedido {pedido.get_status_display().lower()} não pode ser concluído de novo."})
        erro = validar_conclusao(pedido)
        if erro:
            raise ValidationError({"detail": erro})
        padrao = ContaGerencial.objects.filter(pk=CONTA_COMPRAS).first()
        for parcela in pedido.parcelas.all():
            if not parcela.conta_gerencial_id:
                parcela.conta_gerencial = padrao
                parcela.save(update_fields=["conta_gerencial"])
            ContaPagar.objects.create(
                origem=OrigemFinanceira.COMPRAS, origem_id=pedido.id, parcela_compra=parcela, fornecedor=pedido.fornecedor,
                conta_gerencial=parcela.conta_gerencial, tipo_pagamento=parcela.tipo_pagamento, documento=parcela.descricao[:60],
                descricao=f"Pedido de Compra Nº {pedido.id}", parcela=parcela.numero, parcelas=parcela.quantidade,
                emissao=pedido.emissao, vencimento=parcela.vencimento, valor=parcela.valor, saldo=parcela.valor,
                criado_por=request.user, atualizado_por=request.user,
            )
        if request.data.get("atualizar_custo"):
            for item in pedido.itens.select_related("produto"):
                if item.produto_id and item.produto.preco_custo != item.valor_unitario:
                    item.produto.preco_custo = item.valor_unitario
                    item.produto.save(update_fields=["preco_custo"])
        pedido.status = PedidoCompra.Status.FATURADO
        pedido.data_faturamento = timezone.now()
        pedido.atualizado_por = request.user
        pedido.save()
        return Response(self._dados(pk))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def receber(self, request, pk=None):
        """"Receber pedido": quantidades a receber (parcial), local, NF, lote e validade → entrada no estoque (origem 4)."""
        from apps.estoque.models import Movimentacao
        from apps.estoque.regras import registrar

        pedido = self.get_object()
        if pedido.status != PedidoCompra.Status.FATURADO:
            raise ValidationError({"detail": "Só pedido faturado pode ser recebido. Conclua o pedido primeiro."})
        dados = ReceberSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados = dados.validated_data
        local = _local(dados.get("local"))
        itens = {i.id: i for i in pedido.itens.select_related("produto", "unidade")}
        hoje = timezone.localdate()
        entradas = []
        for linha in dados["itens"]:
            item = itens.get(linha["item"])
            if not item:
                raise ValidationError({"itens": "Item não é deste pedido."})
            q = linha["quantidade"]
            if q <= 0:
                continue
            if q > item.quantidade - item.recebido:
                raise ValidationError({"itens": f"{item.descricao}: a quantidade a receber passa do que falta receber ({item.quantidade - item.recebido:.3f})."})
            if linha.get("validade") and linha["validade"] <= hoje:
                raise ValidationError({"itens": f"{item.descricao}: a validade tem que ser uma data futura."})
            item.recebido += q
            item.lote = linha.get("lote") or item.lote
            item.validade = linha.get("validade") or item.validade
            item.save(update_fields=["recebido", "lote", "validade"])
            if item.produto_id:
                entradas.append({
                    "produto": item.produto, "quantidade": q, "unidade": item.unidade, "valor_unitario": _custo_unitario(item),
                    "lote": item.lote, "validade": item.validade,
                })
        if not entradas and not any(l["quantidade"] > 0 for l in dados["itens"]):
            raise ValidationError({"itens": "Informe a quantidade a receber de pelo menos um item."})
        for campo in ("nota_numero", "nota_serie", "nota_emissao"):
            if dados.get(campo):
                setattr(pedido, campo, dados[campo])
        if entradas:
            registrar(
                tipo=Movimentacao.Tipo.ENTRADA, origem=Movimentacao.Origem.COMPRA, origem_id=pedido.id, manual=False, usuario=request.user,
                data=dados["data"], local_destino=local, pessoa=pedido.fornecedor.nome, informacoes=dados.get("observacao", ""),
                nota_numero=pedido.nota_numero, nota_serie=pedido.nota_serie, nota_emissao=pedido.nota_emissao, itens=entradas,
            )
        pedido.atualizado_por = request.user
        pedido.save()
        return Response(self._dados(pk))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def devolver(self, request, pk=None):
        """
        "Devolução / troca": devolver sai do estoque (origem 11) e o valor (quantidade × total ÷ quantidade do item) abate o saldo
        das contas a pagar em aberto; o que passar do saldo (já pago) volta como estorno no caixa. Trocar só registra.
        """
        from apps.estoque.models import Movimentacao
        from apps.estoque.regras import registrar

        pedido = self.get_object()
        if pedido.status != PedidoCompra.Status.FATURADO:
            raise ValidationError({"detail": "Só pedido faturado pode ter devolução."})
        dados = DevolverSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados = dados.validated_data
        itens = {i.id: i for i in pedido.itens.select_related("produto", "unidade")}
        data = dados.get("data") or timezone.localdate()
        linhas, saidas, total = [], [], ZERO
        for linha in dados["itens"]:
            item = itens.get(linha["item"])
            if not item:
                raise ValidationError({"itens": "Item não é deste pedido."})
            devolver, trocar = linha["devolver"], linha["trocar"]
            if devolver < 0 or trocar < 0:
                raise ValidationError({"itens": "Quantidade inválida."})
            if not devolver and not trocar:
                continue
            if trocar > item.recebido:
                raise ValidationError({"itens": "A quantidade disponível para troca é a quantidade recebida do item."})
            if devolver + trocar > item.quantidade or devolver > item.recebido - item.devolvido:
                raise ValidationError({"itens": "As quantidades informadas excedem quantidade do item."})
            valor = dinheiro(devolver * dinheiro(item.total / item.quantidade)) if devolver else ZERO
            total += valor
            linhas.append((item, devolver, trocar, valor))
            if devolver and item.produto_id:
                saidas.append({"produto": item.produto, "quantidade": devolver, "unidade": item.unidade, "valor_unitario": _custo_unitario(item)})
        if not linhas:
            raise ValidationError({"itens": "Informe a quantidade a devolver ou trocar."})
        # Abate o saldo em aberto, da parcela que vence por último para a primeira.
        restante = total
        for conta in contas_do_pedido(pedido.id).filter(saldo__gt=0).order_by("-vencimento", "-id"):
            if restante <= 0:
                break
            abate = min(conta.saldo, restante)
            conta.valor -= abate
            conta.saldo -= abate
            conta.observacao = (conta.observacao + f"\nAbatido R$ {abate:.2f} pela devolução de {data:%d/%m/%Y}.").strip()
            conta.atualizado_por = request.user
            conta.save()
            restante -= abate
        estorno = restante
        if estorno > 0 and not dados.get("conta_corrente"):
            raise ValidationError({"conta_corrente": f"Valor estorno de R$ {estorno:.2f}: informe a conta corrente onde ele entra."})
        local = _local(dados.get("local"))
        devolucao = DevolucaoCompra.objects.create(
            pedido=pedido, data=data, valor_devolvido=total, valor_abatido=total - estorno, valor_estorno=estorno,
            tipo_pagamento=dados.get("tipo_pagamento"), conta_corrente=dados.get("conta_corrente"), local=local,
            criado_por=request.user, atualizado_por=request.user,
        )
        for item, devolver, trocar, valor in linhas:
            ItemDevolucaoCompra.objects.create(devolucao=devolucao, item=item, devolver=devolver, trocar=trocar, valor=valor)
            if devolver:
                item.devolvido += devolver
                item.valor_devolvido += valor
                item.data_devolucao = data
                item.save(update_fields=["devolvido", "valor_devolvido", "data_devolucao"])
        if estorno > 0:
            LancamentoCaixa.objects.create(
                data=data, conta_corrente=dados["conta_corrente"], tipo_pagamento=dados.get("tipo_pagamento"), credito=True, valor=estorno,
                descricao=f"ESTORNO DA DEVOLUÇÃO DO PEDIDO DE COMPRA Nº {pedido.id} - {(pedido.conta_gerencial.nome if pedido.conta_gerencial else '').upper()}".rstrip(" -"),
                conta_gerencial=pedido.conta_gerencial or ContaGerencial.objects.filter(pk=CONTA_COMPRAS).first(),
                origem=OrigemFinanceira.COMPRAS, origem_id=pedido.id, criado_por=request.user, atualizado_por=request.user,
            )
        if saidas:
            registrar(
                tipo=Movimentacao.Tipo.SAIDA, origem=Movimentacao.Origem.DEVOLUCAO_COMPRA, origem_id=pedido.id, manual=False, usuario=request.user,
                data=data, local_origem=local, pessoa=pedido.fornecedor.nome, itens=saidas,
            )
        return Response(self._dados(pk))

    @action(detail=True, methods=["get"], url_path="cancelamento")
    def cancelamento(self, request, pk=None):
        """O que o cancelamento vai desfazer: valor já pago e itens recebidos que movimentam estoque."""
        pedido = self.get_object()
        pago = sum((c.valor - c.saldo for c in contas_do_pedido(pedido.id)), ZERO)
        recebidos = sum(1 for i in pedido.itens.all() if i.produto_id and i.produto.movimenta_estoque and i.recebido - i.devolvido > 0)
        return Response({"valor_pago": f"{pago:.2f}", "itens_recebidos": recebidos})

    @action(detail=True, methods=["patch", "post"])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        """
        Cancelar (doCancel): as contas a pagar saem do financeiro e as parcelas do pedido; o que já foi pago volta ao caixa (estorno,
        entrada); os itens recebidos que movimentam estoque saem do local escolhido (origem 10).
        """
        from apps.estoque.models import Movimentacao
        from apps.estoque.regras import registrar

        pedido = self.get_object()
        if pedido.status == PedidoCompra.Status.CANCELADO:
            raise ValidationError({"detail": "Este pedido já está cancelado."})
        dados = CancelarSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados = dados.validated_data
        contas = list(contas_do_pedido(pedido.id))
        pago = sum((c.valor - c.saldo for c in contas), ZERO)
        estorno = dados.get("valor_estorno", pago)
        if estorno < 0 or estorno > pago:
            raise ValidationError({"valor_estorno": f"O estorno vai de R$ 0,00 até o valor pago (R$ {pago:.2f})."})
        if estorno > 0 and not dados.get("conta_corrente"):
            raise ValidationError({"conta_corrente": "Informe a conta corrente onde entra o valor estornado."})
        data = dados.get("data") or timezone.localdate()
        if estorno > 0:
            LancamentoCaixa.objects.create(
                data=data, conta_corrente=dados["conta_corrente"], tipo_pagamento=dados.get("tipo_pagamento"), credito=True, valor=estorno,
                descricao=f"ESTORNO DO CANCELAMENTO DO PEDIDO DE COMPRA Nº {pedido.id} - {(pedido.conta_gerencial.nome if pedido.conta_gerencial else '').upper()}".rstrip(" -"),
                conta_gerencial=pedido.conta_gerencial or ContaGerencial.objects.filter(pk=CONTA_COMPRAS).first(),
                origem=OrigemFinanceira.COMPRAS, origem_id=pedido.id, criado_por=request.user, atualizado_por=request.user,
            )
        ContaPagar.objects.filter(pk__in=[c.pk for c in contas]).update(cancelada=True, atualizado_em=timezone.now())
        pedido.parcelas.all().delete()
        saidas = [
            {"produto": i.produto, "quantidade": i.recebido - i.devolvido, "unidade": i.unidade, "valor_unitario": _custo_unitario(i)}
            for i in pedido.itens.select_related("produto", "unidade") if i.produto_id and i.recebido - i.devolvido > 0
        ]
        if saidas:
            registrar(
                tipo=Movimentacao.Tipo.SAIDA, origem=Movimentacao.Origem.CANCELAMENTO_COMPRA, origem_id=pedido.id, manual=False,
                usuario=request.user, data=data, local_origem=_local(dados.get("local")), pessoa=pedido.fornecedor.nome, itens=saidas,
            )
        pedido.status = PedidoCompra.Status.CANCELADO
        pedido.data_cancelamento = timezone.now()
        pedido.atualizado_por = request.user
        pedido.save()
        return Response(self._dados(pk))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def copiar(self, request, pk=None):
        """Ícone "copiar": novo pedido Novo com o mesmo fornecedor e itens, datas de hoje, sem parcelas, NF e recebimentos."""
        original = self.get_object()
        hoje = timezone.localdate()
        itens = list(original.itens.all())
        copia = PedidoCompra.objects.get(pk=original.pk)
        copia.pk = None
        copia.status = PedidoCompra.Status.NOVO
        copia.emissao = copia.previsao = hoje
        copia.data_faturamento = copia.data_cancelamento = copia.nota_emissao = copia.orcamento_id = None
        copia.nota_numero = copia.nota_serie = ""
        copia.criado_por = copia.atualizado_por = request.user
        copia.save()
        for item in itens:
            item.pk = None
            item.pedido = copia
            item.recebido = item.devolvido = item.valor_devolvido = 0
            item.data_devolucao = None
        ItemPedidoCompra.objects.bulk_create(itens)
        return Response(PedidoCompraSerializer(copia, context={"request": request}).data, status=201)

    @action(detail=False, methods=["get"])
    def devolucoes(self, request):
        """Compras › Devoluções: Pedido · Data · Devolução efetuada por · Forma de pagamento · Valor."""
        qs = DevolucaoCompra.objects.select_related("pedido__fornecedor", "criado_por", "tipo_pagamento").order_by("-data", "-id")
        return Response([
            {
                "id": d.id, "pedido": d.pedido_id, "fornecedor_nome": d.pedido.fornecedor.nome, "data": d.data,
                "usuario": (d.criado_por.get_full_name() or d.criado_por.username) if d.criado_por else "",
                "tipo_pagamento_nome": d.tipo_pagamento.descricao if d.tipo_pagamento else "", "valor": f"{d.valor_devolvido:.2f}",
                "valor_estorno": f"{d.valor_estorno:.2f}",
            }
            for d in qs
        ])
