"""
API de pedidos de venda (T203). Regras conferidas na MarketUP em 08/11/2026 (só leitura do código da tela):
- billCurrentOrder: validações do "Concluir venda" e geração das contas a receber.
- showDelivery: entregar o pedido (o estoque sai na T301).
- checkOrderCancellation / doCancel: cancelar com estorno do valor recebido.
- orderCurrentBudget: "Gerar pedido" do orçamento (o orçamento fica Concluído).
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Exists, OuterRef, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.financeiro.models import ContaCorrente, ContaReceber, LancamentoCaixa, TipoPagamento
from apps.financeiro.recebimentos import conta_gerencial_vendas
from apps.usuarios.models import Funcionario

from .models import Orcamento, ParametrosVenda, Pedido
from .orcamentos import OrcamentoViewSet, _data, vendedor_logado
from .serializers import OrcamentoSerializer, PedidoListaSerializer, PedidoSerializer

ZERO = Decimal(0)


def contas_do_pedido(pedido_id):
    return ContaReceber.objects.filter(origem=ContaReceber.Origem.VENDAS, origem_id=pedido_id, cancelada=False)


def atualizar_situacao_financeira(pedido_id):
    """Pendente, pago parcialmente ou pago, pelo saldo das contas a receber do pedido."""
    pedido = Pedido.objects.filter(pk=pedido_id).first()
    if not pedido or pedido.status == Pedido.Status.CANCELADO:
        return
    soma = contas_do_pedido(pedido_id).aggregate(valor=Sum("valor"), saldo=Sum("saldo"))
    valor, saldo = soma["valor"] or ZERO, soma["saldo"] or ZERO
    if valor and saldo <= 0:
        situacao = Pedido.Financeiro.PAGO
    elif saldo < valor:
        situacao = Pedido.Financeiro.PARCIAL
    else:
        situacao = Pedido.Financeiro.PENDENTE
    if pedido.situacao_financeira != situacao:
        pedido.situacao_financeira = situacao
        pedido.save(update_fields=["situacao_financeira", "atualizado_em"])


def credito_disponivel(cliente) -> Decimal:
    """Limite de crédito do cliente menos o que ele já deve (contas a receber em aberto)."""
    aberto = ContaReceber.objects.filter(cliente=cliente, cancelada=False, saldo__gt=0).aggregate(s=Sum("saldo"))["s"] or ZERO
    return cliente.limite_credito - aberto


def validar_conclusao(pedido: Pedido):
    """As validações do billCurrentOrder da MarketUP, na mesma ordem. Devolve a primeira mensagem."""
    cliente = pedido.cliente
    if not cliente:
        return "Nome do cliente é obrigatório"
    if not pedido.endereco_faturamento_id:
        return "Informe o endereço para faturamento."
    if not pedido.endereco_entrega_id:
        return "Informe o endereço de entrega."
    itens = list(pedido.itens.all())
    if not itens:
        return "Inclua pelo menos um item no pedido."
    parcelas = list(pedido.parcelas.all())
    soma = sum((p.valor for p in parcelas), ZERO)
    if not parcelas or soma != pedido.total:
        return "Forma/Condição de pagamento inválida. A soma das parcelas tem que ser igual ao valor total do pedido."
    if any(p.valor <= 0 for p in parcelas) or pedido.total <= 0:
        return "Verifique o valor das parcelas, total inválido."
    if any(p.vencimento < pedido.emissao for p in parcelas):
        return "Existem parcelas vencidas. A data de vencimento não pode ser antes da emissão do pedido."
    parametros = ParametrosVenda.atual()
    if parametros.utilizar_limite_credito:
        a_prazo = sum((p.valor for p in parcelas if p.vencimento > pedido.emissao), ZERO)
        disponivel = credito_disponivel(cliente)
        if a_prazo > 0 and a_prazo > disponivel:
            return (
                f"O limite de crédito disponível para este cliente (R$ {disponivel:.2f}) está abaixo "
                f"do valor (a prazo) a ser faturado (R$ {a_prazo:.2f})."
            )
    return None


class CancelarSerializer(serializers.Serializer):
    """Modal de cancelamento com valor já recebido: quanto devolver, quando e como."""

    valor_estorno = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    data = serializers.DateField(required=False)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    conta_corrente = serializers.PrimaryKeyRelatedField(queryset=ContaCorrente.objects.all(), required=False, allow_null=True)


class PedidoViewSet(OrcamentoViewSet):
    """Herda do orçamento: vendedores e "Gerar contas" são iguais."""

    funcionalidade = "pedidos"
    queryset = Pedido.objects.select_related("cliente", "vendedor")
    ordering_fields = ["id", "emissao", "data_faturamento", "total"]

    def get_serializer_class(self):
        return PedidoListaSerializer if self.action == "list" else PedidoSerializer

    def get_queryset(self):
        queryset = Pedido.objects.select_related("cliente", "vendedor").prefetch_related(
            "itens", "parcelas__contas__recebimentos"
        )
        if self.action != "list":
            queryset = queryset.prefetch_related(
                "itens__unidade", "itens__produto", "itens__servico", "parcelas__tipo_pagamento", "parcelas__condicao_pagamento"
            )
        # Filtros da MarketUP: Status, Cliente, Data de emissão e de faturamento, Produtos, Valor, Entrega e Financeiro.
        p = self.request.query_params
        hoje = timezone.localdate()
        if p.get("status"):
            queryset = queryset.filter(status__in=p["status"].split(","))
        if p.get("cliente"):
            queryset = queryset.filter(Q(cliente__nome__icontains=p["cliente"]) | Q(cliente__apelido__icontains=p["cliente"]))
        for campo, coluna in (("emissao", "emissao"), ("faturamento", "data_faturamento__date")):
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
        if p.get("entrega"):
            escolhas = {int(x) for x in p["entrega"].split(",") if x.isdigit()}
            filtro = Q(situacao_entrega__in=escolhas - {Pedido.Entrega.ATRASADO, Pedido.Entrega.PENDENTE})
            atrasado = Q(status=Pedido.Status.FATURADO, situacao_entrega=Pedido.Entrega.PENDENTE, entrega__lt=hoje)
            if Pedido.Entrega.PENDENTE in escolhas:
                filtro |= Q(situacao_entrega=Pedido.Entrega.PENDENTE) & ~atrasado
            if Pedido.Entrega.ATRASADO in escolhas:
                filtro |= atrasado
            queryset = queryset.filter(filtro)
        if p.get("financeiro"):
            escolhas = {int(x) for x in p["financeiro"].split(",") if x.isdigit()}
            vencida = ContaReceber.objects.filter(
                origem=ContaReceber.Origem.VENDAS, origem_id=OuterRef("pk"), cancelada=False, saldo__gt=0, vencimento__lt=hoje
            )
            queryset = queryset.annotate(_vencida=Exists(vencida))
            abertos = {Pedido.Financeiro.PENDENTE, Pedido.Financeiro.PARCIAL}
            filtro = Q(situacao_financeira__in=escolhas - abertos - {Pedido.Financeiro.ATRASADO})
            for situacao in escolhas & abertos:
                filtro |= Q(situacao_financeira=situacao, _vencida=False)
            if Pedido.Financeiro.ATRASADO in escolhas:
                filtro |= Q(situacao_financeira__in=abertos, _vencida=True)
            queryset = queryset.filter(filtro)
        return queryset

    def perform_destroy(self, instance):
        if instance.status != Pedido.Status.NOVO:
            raise ValidationError({"detail": "Só pedido Novo pode ser excluído. Use Cancelar."})
        instance.delete()

    @action(detail=False, methods=["get"])
    def novo(self, request):
        """
        Valores iniciais: emissão hoje, entrega pelos Parâmetros de venda ("Entrega para pedido"), vendedor logado.
        Com ?orcamento=N, copia o orçamento (como "Gerar pedido" da MarketUP); só grava ao salvar.
        """
        parametros = ParametrosVenda.atual()
        hoje = timezone.localdate()
        numero = request.query_params.get("orcamento")
        if numero:
            orcamento = Orcamento.objects.filter(pk=numero).first()
            if not orcamento:
                raise ValidationError({"orcamento": "Orçamento não encontrado."})
            if orcamento.status != Orcamento.Status.NOVO:
                raise ValidationError({"orcamento": f"O orçamento Nº {orcamento.id} está {orcamento.get_status_display().lower()} e não gera outro pedido."})
            dados = OrcamentoSerializer(orcamento, context={"request": request}).data
            for campo in ("id", "status", "validade", "data_pedido", "pedido_id", "data_cancelamento", "criado_em", "atualizado_em"):
                dados.pop(campo, None)
            for linha in dados["itens"] + dados["parcelas"]:
                linha.pop("id", None)
            dados.update({"orcamento": orcamento.id, "emissao": hoje, "status": Pedido.Status.NOVO})
            # O vendedor do orçamento passa para o pedido; sem vendedor no orçamento, entra quem está logado.
            if not dados.get("vendedor"):
                dados["vendedor"] = vendedor_logado(request.user)
                dados["vendedor_nome"] = Funcionario.objects.filter(pk=dados["vendedor"]).values_list("nome", flat=True).first()
            if not dados.get("entrega") or str(dados["entrega"]) < str(hoje):
                dados["entrega"] = hoje + timedelta(days=parametros.venda_entrega_pedido)
            return Response(dados)
        return Response({"emissao": hoje, "entrega": hoje + timedelta(days=parametros.venda_entrega_pedido), "vendedor": vendedor_logado(request.user)})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def concluir(self, request, pk=None):
        """"Concluir venda": confere, fatura e gera uma conta a receber por parcela."""
        pedido = self.get_object()
        if pedido.status != Pedido.Status.NOVO:
            raise ValidationError({"detail": f"Pedido {pedido.get_status_display().lower()} não pode ser concluído de novo."})
        erro = validar_conclusao(pedido)
        if erro:
            raise ValidationError({"detail": erro})
        conta_gerencial = conta_gerencial_vendas()
        for parcela in pedido.parcelas.all():
            ContaReceber.objects.create(
                origem=ContaReceber.Origem.VENDAS, origem_id=pedido.id, parcela_pedido=parcela, cliente=pedido.cliente,
                conta_gerencial=conta_gerencial, tipo_pagamento=parcela.tipo_pagamento,
                descricao=f"Pedido de Venda Nº {pedido.id}", parcela=parcela.numero, parcelas=parcela.quantidade,
                emissao=pedido.emissao, vencimento=parcela.vencimento, valor=parcela.valor, saldo=parcela.valor,
                criado_por=request.user, atualizado_por=request.user,
            )
        # Só serviço: nada a entregar.
        so_servico = not any(i.produto_id for i in pedido.itens.all())
        pedido.status = Pedido.Status.FATURADO
        pedido.data_faturamento = timezone.now()
        pedido.situacao_entrega = Pedido.Entrega.ENTREGUE if so_servico else Pedido.Entrega.PENDENTE
        pedido.situacao_financeira = Pedido.Financeiro.PENDENTE
        pedido.atualizado_por = request.user
        pedido.save()
        # Comissão automática do vendedor (T205): (total − frete) × % do vendedor.
        from apps.comissoes.regras import gerar_do_pedido

        gerar_do_pedido(pedido, request.user)
        return Response(self._dados(pk))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def entregar(self, request, pk=None):
        """"Entregar pedido": marca os itens como entregues. A baixa no estoque por local vem com a T301."""
        pedido = self.get_object()
        if pedido.status != Pedido.Status.FATURADO:
            raise ValidationError({"detail": "Só pedido faturado pode ser entregue. Conclua a venda primeiro."})
        if pedido.situacao_entrega == Pedido.Entrega.ENTREGUE:
            raise ValidationError({"detail": "Este pedido já foi entregue."})
        data = _data(request.data.get("data"), "data") or timezone.localdate()
        for item in pedido.itens.all():
            item.entregue = item.quantidade
            item.save(update_fields=["entregue"])
        pedido.situacao_entrega = Pedido.Entrega.ENTREGUE
        pedido.data_entregue = data
        pedido.atualizado_por = request.user
        pedido.save()
        return Response(self._dados(pk))

    @action(detail=True, methods=["get"], url_path="cancelamento")
    def cancelamento(self, request, pk=None):
        """O que o cancelamento vai desfazer (checkOrderCancellation): valor já recebido e itens entregues."""
        pedido = self.get_object()
        recebido = sum((c.valor - c.saldo for c in contas_do_pedido(pedido.id)), ZERO)
        entregues = sum((i.entregue for i in pedido.itens.all() if i.produto_id), ZERO)
        return Response({"valor_recebido": f"{recebido:.2f}", "itens_entregues": f"{entregues:.3f}"})

    @action(detail=True, methods=["patch", "post"])
    @transaction.atomic
    def cancelar(self, request, pk=None):
        """
        Cancela o pedido (doCancel da MarketUP): as contas a receber saem do financeiro, as parcelas saem do pedido,
        e o valor já recebido é estornado no caixa (saída). O orçamento de origem continua Concluído.
        """
        pedido = self.get_object()
        if pedido.status == Pedido.Status.CANCELADO:
            raise ValidationError({"detail": "Este pedido já está cancelado."})
        dados = CancelarSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados = dados.validated_data
        contas = list(contas_do_pedido(pedido.id))
        recebido = sum((c.valor - c.saldo for c in contas), ZERO)
        estorno = dados.get("valor_estorno", recebido)
        if estorno < 0 or estorno > recebido:
            raise ValidationError({"valor_estorno": f"O estorno vai de R$ 0,00 até o valor recebido (R$ {recebido:.2f})."})
        if estorno > 0 and not dados.get("conta_corrente"):
            raise ValidationError({"conta_corrente": "Informe a conta corrente de onde sai o valor estornado."})
        if estorno > 0:
            LancamentoCaixa.objects.create(
                data=dados.get("data") or timezone.localdate(), conta_corrente=dados.get("conta_corrente"),
                tipo_pagamento=dados.get("tipo_pagamento"), credito=False, valor=estorno,
                descricao=f"Estorno do cancelamento do Pedido de Venda Nº {pedido.id}",
                origem=ContaReceber.Origem.VENDAS, origem_id=pedido.id, criado_por=request.user, atualizado_por=request.user,
            )
        ContaReceber.objects.filter(pk__in=[c.pk for c in contas]).update(cancelada=True, atualizado_em=timezone.now())
        pedido.parcelas.all().delete()
        pedido.status = Pedido.Status.CANCELADO
        pedido.situacao_entrega = Pedido.Entrega.CANCELADO
        pedido.situacao_financeira = Pedido.Financeiro.CANCELADO
        pedido.data_cancelamento = timezone.now()
        pedido.atualizado_por = request.user
        pedido.save()
        # Comissão (T205): em aberto é apagada; já fechada recebe estorno para o próximo fechamento.
        from apps.comissoes.regras import estornar_do_pedido

        estornar_do_pedido(pedido, request.user)
        return Response(self._dados(pk))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def copiar(self, request, pk=None):
        """Ícone "copiar": novo pedido Novo com o mesmo cliente e itens, datas de hoje, sem parcelas e sem orçamento."""
        original = self.get_object()
        parametros = ParametrosVenda.atual()
        hoje = timezone.localdate()
        itens = list(original.itens.all())
        copia = Pedido.objects.get(pk=original.pk)
        copia.pk = None
        copia.status = Pedido.Status.NOVO
        copia.situacao_entrega = Pedido.Entrega.PENDENTE
        copia.situacao_financeira = Pedido.Financeiro.PENDENTE
        copia.emissao = hoje
        copia.entrega = hoje + timedelta(days=parametros.venda_entrega_pedido)
        copia.data_faturamento = copia.data_cancelamento = copia.data_entregue = copia.orcamento = None
        copia.criado_por = copia.atualizado_por = request.user
        copia.save()
        for item in itens:
            item.pk = None
            item.pedido = copia
            item.entregue = 0
        copia.itens.model.objects.bulk_create(itens)
        return Response(PedidoSerializer(copia, context={"request": request}).data, status=201)

    def _dados(self, pk):
        return PedidoSerializer(self.get_queryset().get(pk=pk), context={"request": self.request}).data
