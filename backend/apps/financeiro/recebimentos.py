"""
Contas a receber: o mínimo que o pedido (T203) usa. A tela completa e o fluxo de caixa ficam na T302.

Regras da MarketUP (receivable/detail, conferido no título 12163 do pedido 2990 em 08/11/2026, só leitura):
- Cada parcela do pedido concluído vira um título: "Pedido de Venda Nº X", sacado = cliente,
  origem 7 (Vendas), chave = número do pedido, conta gerencial 52 "Vendas via Pedido".
- "Efetuar recebimento": data, conta corrente, juros (+), descontos (−), valor recebido (=) e forma.
  O saldo cai pelo valor amortizado = recebido − juros + desconto. Cada recebimento lança a entrada no caixa.
- O X vermelho do histórico estorna o recebimento: o saldo volta e o caixa recebe a saída.
- Recibo da parcela: valor total = valor − saldo + juros − desconto; data = último recebimento.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import PermissaoFuncionalidade

from .models import ContaCorrente, ContaGerencial, ContaReceber, LancamentoCaixa, Recebimento, TipoPagamento

CONTA_VENDAS_PEDIDO = 52  # ManagementAccountID "Vendas via Pedido" da MarketUP
ZERO = Decimal(0)


def conta_gerencial_vendas():
    return ContaGerencial.objects.filter(pk=CONTA_VENDAS_PEDIDO).first()


def atualizar_pedido(conta: ContaReceber):
    """Recalcula o status de pagamento do pedido de origem depois de receber ou estornar."""
    if conta.origem != ContaReceber.Origem.VENDAS or not conta.origem_id:
        return
    from apps.vendas.pedidos import atualizar_situacao_financeira

    atualizar_situacao_financeira(conta.origem_id)


@transaction.atomic
def receber(conta: ContaReceber, *, data, valor, juros=ZERO, desconto=ZERO, tipo_pagamento=None, conta_corrente=None, usuario=None) -> Recebimento:
    conta = ContaReceber.objects.select_for_update().get(pk=conta.pk)
    if conta.cancelada:
        raise ValidationError({"detail": "Esta conta foi cancelada e não recebe mais."})
    valor, juros, desconto = Decimal(valor), Decimal(juros or 0), Decimal(desconto or 0)
    if juros < 0 or desconto < 0:
        raise ValidationError({"detail": "Juros e desconto não podem ser negativos."})
    if valor <= 0:
        raise ValidationError({"valor": "Informe o valor recebido."})
    amortizado = valor - juros + desconto
    if amortizado <= 0:
        raise ValidationError({"valor": "O valor recebido não cobre os juros."})
    if amortizado > conta.saldo:
        raise ValidationError({"valor": f"O valor do recebimento excede o valor a receber (R$ {conta.saldo:.2f})."})
    lancamento = LancamentoCaixa.objects.create(
        data=data, conta_corrente=conta_corrente, tipo_pagamento=tipo_pagamento, credito=True, valor=valor,
        descricao=f"Recebimento: {conta.descricao} - parcela {conta.parcela}/{conta.parcelas}",
        origem=conta.origem, origem_id=conta.origem_id, criado_por=usuario, atualizado_por=usuario,
    )
    recebimento = Recebimento.objects.create(
        conta=conta, data=data, valor=valor, juros=juros, desconto=desconto, tipo_pagamento=tipo_pagamento,
        conta_corrente=conta_corrente, lancamento=lancamento, criado_por=usuario, atualizado_por=usuario,
    )
    conta.saldo -= amortizado
    conta.atualizado_por = usuario
    conta.save(update_fields=["saldo", "atualizado_por", "atualizado_em"])
    atualizar_pedido(conta)
    return recebimento


@transaction.atomic
def estornar(recebimento: Recebimento, usuario=None, data=None) -> Recebimento:
    recebimento = Recebimento.objects.select_for_update().select_related("conta").get(pk=recebimento.pk)
    if recebimento.estornado_em:
        raise ValidationError({"detail": "Este recebimento já foi estornado."})
    conta = recebimento.conta
    LancamentoCaixa.objects.create(
        data=data or timezone.localdate(), conta_corrente=recebimento.conta_corrente, tipo_pagamento=recebimento.tipo_pagamento,
        credito=False, valor=recebimento.valor, descricao=f"Estorno de recebimento: {conta.descricao} - parcela {conta.parcela}/{conta.parcelas}",
        origem=conta.origem, origem_id=conta.origem_id, criado_por=usuario, atualizado_por=usuario,
    )
    recebimento.estornado_em = timezone.now()
    recebimento.atualizado_por = usuario
    recebimento.save(update_fields=["estornado_em", "atualizado_por", "atualizado_em"])
    if not conta.cancelada:
        conta.saldo += recebimento.amortizado
        conta.save(update_fields=["saldo", "atualizado_em"])
        atualizar_pedido(conta)
    return recebimento


def recibo(conta: ContaReceber, usuario=None) -> dict:
    """Dados do modal "EMITIR RECIBO" (showDocket da MarketUP)."""
    validos = [r for r in conta.recebimentos.all() if not r.estornado_em]
    juros = sum((r.juros for r in validos), ZERO)
    desconto = sum((r.desconto for r in validos), ZERO)
    cliente = conta.cliente
    referente = f"{conta.descricao} - PARCELA {conta.parcela} / {conta.parcelas}"
    if conta.origem == ContaReceber.Origem.VENDAS and conta.origem_id:
        referente = f"PEDIDO {conta.origem_id} - PARCELA {conta.parcela} / {conta.parcelas}"
    funcionario = getattr(usuario, "funcionario", None) if usuario else None
    return {
        "conta": conta.id,
        "recebi_de": cliente.nome if cliente else "",
        "documento": (cliente.cnpj or cliente.cpf) if cliente else "",
        "email": cliente.email if cliente else "",
        "formas": sorted({r.tipo_pagamento.descricao for r in validos if r.tipo_pagamento}),
        "vencimento": conta.vencimento,
        "parcela": f"{conta.parcela}/{conta.parcelas}",
        "numero": conta.id,
        "data": max((r.data for r in validos), default=None),
        "subtotal": f"{conta.valor:.2f}",
        "juros": f"{juros:.2f}",
        "desconto": f"{desconto:.2f}",
        "total": f"{conta.valor - conta.saldo + juros - desconto:.2f}",
        "referente": referente,
        "assinatura": getattr(funcionario, "nome", None) or (usuario.get_full_name() or usuario.username if usuario else ""),
    }


# ---- API ----


class RecebimentoSerializer(serializers.ModelSerializer):
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", default=None, read_only=True)
    conta_corrente_nome = serializers.CharField(source="conta_corrente.nome", default=None, read_only=True)

    class Meta:
        model = Recebimento
        fields = [
            "id", "data", "valor", "desconto", "juros", "tipo_pagamento", "tipo_pagamento_nome",
            "conta_corrente", "conta_corrente_nome", "estornado_em",
        ]


class ContaReceberSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)
    conta_gerencial_nome = serializers.CharField(source="conta_gerencial.nome", default=None, read_only=True)
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", default=None, read_only=True)
    recebimentos = RecebimentoSerializer(many=True, read_only=True)
    situacao = serializers.SerializerMethodField()

    class Meta:
        model = ContaReceber
        fields = [
            "id", "origem", "origem_id", "cliente", "cliente_nome", "conta_gerencial", "conta_gerencial_nome",
            "tipo_pagamento", "tipo_pagamento_nome", "descricao", "parcela", "parcelas", "emissao", "vencimento",
            "valor", "saldo", "cancelada", "situacao", "recebimentos",
        ]

    def get_situacao(self, conta):
        # Faixa de status do título na MarketUP.
        if conta.cancelada:
            return "cancelada"
        if conta.saldo <= 0:
            return "recebida"
        if conta.saldo < conta.valor:
            return "parcial"
        return "vencida" if conta.vencimento < timezone.localdate() else "aberta"


class ReceberSerializer(serializers.Serializer):
    data = serializers.DateField()
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    juros = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=ZERO)
    desconto = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=ZERO)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    # Como na MarketUP: todo recebimento entra numa conta (Caixa, banco…); vem preenchida com a conta Principal.
    conta_corrente = serializers.PrimaryKeyRelatedField(
        queryset=ContaCorrente.objects.filter(ativo=True),
        error_messages={"required": "Informe a conta corrente onde o valor entrou.", "null": "Informe a conta corrente onde o valor entrou."},
    )


class ContaReceberViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Títulos a receber. Incluir e alterar à mão fica na T302; aqui: consultar, receber, estornar e recibo."""

    funcionalidade = "contas_receber"
    funcionalidades_leitura = ["pedidos"]
    permission_classes = [PermissaoFuncionalidade]
    serializer_class = ContaReceberSerializer
    queryset = ContaReceber.objects.select_related("cliente", "conta_gerencial", "tipo_pagamento").prefetch_related(
        "recebimentos__tipo_pagamento", "recebimentos__conta_corrente"
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        p = self.request.query_params
        if p.get("origem"):
            queryset = queryset.filter(origem=p["origem"])
        if p.get("origem_id"):
            queryset = queryset.filter(origem_id=p["origem_id"])
        return queryset

    @action(detail=True, methods=["post"])
    def receber(self, request, pk=None):
        dados = ReceberSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        receber(self.get_object(), usuario=request.user, **dados.validated_data)
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)

    @action(detail=True, methods=["post"], url_path=r"recebimentos/(?P<recebimento>\d+)/estornar")
    def estornar(self, request, pk=None, recebimento=None):
        conta = self.get_object()
        alvo = conta.recebimentos.filter(pk=recebimento).first()
        if not alvo:
            raise ValidationError({"detail": "Recebimento não encontrado."})
        estornar(alvo, usuario=request.user)
        return Response(self.get_serializer(self.get_queryset().get(pk=pk)).data)

    @action(detail=True, methods=["get"])
    def recibo(self, request, pk=None):
        conta = self.get_object()
        if conta.valor - conta.saldo <= 0:
            raise ValidationError({"detail": "Esta parcela ainda não tem recebimento."})
        return Response(recibo(conta, request.user))
