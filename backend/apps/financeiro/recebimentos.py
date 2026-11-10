"""
Contas a receber e a pagar (T302), no modelo da MarketUP (receivable / payable).
Regras em context/marketup/telas-e-entidades.md, seção "Financeiro (T302)".

- A ficha grava o título e as baixas juntos (botão Salvar): baixa nova entra, baixa que saiu da lista é apagada
  (com o movimento dela no caixa). Amortizado = valor + desconto − juros; saldo = valor − Σ amortizado.
- Baixa maior que o saldo: a tela pergunta se a diferença vira juros; o servidor recusa o que passar do saldo.
- Conta corrente obrigatória em toda baixa. Valor, emissão e vencimento travam quando há baixa;
  descrição e sacado/beneficiário travam quando o título veio de um documento (pedido, comissão...).
- Título manual: origem 3 (Receitas) ou 2 (Despesas); pode repetir (2 a 12 vezes, mês a mês) e ser excluído.
"""

from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import PermissaoFuncionalidade

from .models import (
    ContaCorrente,
    ContaGerencial,
    ContaPagar,
    ContaReceber,
    LancamentoCaixa,
    OrigemFinanceira,
    Pagamento,
    Recebimento,
    TipoPagamento,
)

ZERO = Decimal(0)
CONTA_VENDAS_PEDIDO = 52  # "Vendas via Pedido"
CONTA_COMISSAO = 43  # "Comissão de Vendas"
CONTA_DEVOLUCOES = 5  # "Devoluções / Abatimentos"
ORIGENS_MANUAIS = (OrigemFinanceira.DESPESAS, OrigemFinanceira.RECEITAS)


def conta_gerencial(pk):
    return ContaGerencial.objects.filter(pk=pk).first()


def conta_gerencial_vendas():
    return conta_gerencial(CONTA_VENDAS_PEDIDO)


class Lado:
    """O que muda entre receber e pagar."""

    def __init__(self, receber: bool):
        self.receber = receber
        self.Titulo = ContaReceber if receber else ContaPagar
        self.Baixa = Recebimento if receber else Pagamento
        self.baixas = "recebimentos" if receber else "pagamentos"
        self.origem_manual = OrigemFinanceira.RECEITAS if receber else OrigemFinanceira.DESPESAS
        self.verbo = "recebimento" if receber else "pagamento"


RECEBER, PAGAR = Lado(True), Lado(False)


def lado_de(titulo) -> Lado:
    return RECEBER if isinstance(titulo, ContaReceber) else PAGAR


def descricao_movimento(titulo) -> str:
    """Como a Movimentação de caixa da MarketUP: "PEDIDO DE VENDA Nº 2990 - VENDAS VIA PEDIDO"."""
    nome = titulo.conta_gerencial.nome if titulo.conta_gerencial_id else ""
    return f"{titulo.descricao} - {nome}".upper() if nome else titulo.descricao.upper()


def atualizar_origem(titulo):
    """Recalcula o status de pagamento do pedido de origem depois de mexer nas baixas."""
    if isinstance(titulo, ContaReceber) and titulo.origem == OrigemFinanceira.VENDAS and titulo.origem_id:
        from apps.vendas.pedidos import atualizar_situacao_financeira

        atualizar_situacao_financeira(titulo.origem_id)


def recalcular_saldo(titulo):
    lado = lado_de(titulo)
    # Consulta nova (não a lista pré-carregada, que ainda teria a baixa recém-apagada).
    amortizado = sum((b.amortizado for b in lado.Baixa.objects.filter(conta=titulo)), ZERO)
    saldo = titulo.valor - amortizado
    titulo.saldo = ZERO if saldo < Decimal("0.009") else saldo.quantize(Decimal("0.01"))
    titulo.save(update_fields=["saldo", "atualizado_em"])


def criar_baixa(titulo, dados: dict, usuario):
    """Uma baixa nova + o movimento no caixa. `dados`: data, valor, juros, desconto, conta_corrente, tipo_pagamento, observacao."""
    lado = lado_de(titulo)
    if titulo.cancelada:
        raise ValidationError({"detail": "Esta conta foi cancelada."})
    valor, juros, desconto = (Decimal(dados.get(k) or 0) for k in ("valor", "juros", "desconto"))
    if valor < 0 or juros < 0 or desconto < 0 or valor + juros + desconto <= 0:
        raise ValidationError({"detail": f"{lado.verbo.capitalize()} inválido, verifique os valores informados."})
    if not dados.get("conta_corrente"):
        raise ValidationError({"conta_corrente": f"Informe a conta corrente do {lado.verbo}."})
    amortizado = valor + desconto - juros
    if amortizado - titulo.saldo > Decimal("0.001"):
        raise ValidationError(
            {"valor": f"{lado.verbo.capitalize()} maior que o saldo da conta (R$ {titulo.saldo:.2f}). Informe a diferença como juros."}
        )
    lancamento = LancamentoCaixa.objects.create(
        data=dados["data"], conta_corrente=dados["conta_corrente"], tipo_pagamento=dados.get("tipo_pagamento"),
        credito=lado.receber, valor=valor, descricao=descricao_movimento(titulo), manual=titulo.manual,
        conta_gerencial=titulo.conta_gerencial, origem=titulo.origem, origem_id=titulo.origem_id,
        **({"conta_receber": titulo} if lado.receber else {"conta_pagar": titulo}), criado_por=usuario, atualizado_por=usuario,
    )
    baixa = lado.Baixa.objects.create(
        conta=titulo, data=dados["data"], valor=valor, juros=juros, desconto=desconto, tipo_pagamento=dados.get("tipo_pagamento"),
        conta_corrente=dados["conta_corrente"], lancamento=lancamento, observacao=dados.get("observacao") or "",
        criado_por=usuario, atualizado_por=usuario,
    )
    titulo.saldo -= amortizado
    if titulo.saldo < Decimal("0.009"):
        titulo.saldo = ZERO
    titulo.save(update_fields=["saldo", "atualizado_em"])
    return baixa


def apagar_baixa(baixa):
    """O X do histórico: a baixa sai e o movimento dela some do caixa (como a MarketUP)."""
    titulo = baixa.conta
    if baixa.lancamento_id:
        LancamentoCaixa.objects.filter(pk=baixa.lancamento_id).delete()
    baixa.delete()
    recalcular_saldo(titulo)


def recibo(conta: ContaReceber, usuario=None) -> dict:
    """Dados do modal "EMITIR RECIBO" (showDocket da MarketUP)."""
    baixas = list(conta.recebimentos.all())
    juros = sum((r.juros for r in baixas), ZERO)
    desconto = sum((r.desconto for r in baixas), ZERO)
    cliente = conta.cliente
    referente = f"{conta.descricao} - PARCELA {conta.parcela} / {conta.parcelas}"
    if conta.origem == OrigemFinanceira.VENDAS and conta.origem_id:
        referente = f"PEDIDO {conta.origem_id} - PARCELA {conta.parcela} / {conta.parcelas}"
    funcionario = getattr(usuario, "funcionario", None) if usuario else None
    return {
        "conta": conta.id,
        "numero": conta.id,
        "recebi_de": cliente.nome if cliente else "",
        "documento": (cliente.cnpj or cliente.cpf) if cliente else "",
        "email": cliente.email if cliente else "",
        "formas": sorted({r.tipo_pagamento.descricao for r in baixas if r.tipo_pagamento}),
        "vencimento": conta.vencimento,
        "parcela": f"{conta.parcela}/{conta.parcelas}",
        "data": max((r.data for r in baixas), default=None),
        "subtotal": f"{conta.valor:.2f}",
        "juros": f"{juros:.2f}",
        "desconto": f"{desconto:.2f}",
        "total": f"{conta.valor - conta.saldo + juros - desconto:.2f}",
        "referente": referente,
        "assinatura": getattr(funcionario, "nome", None) or (usuario.get_full_name() or usuario.username if usuario else ""),
    }


def situacao(titulo) -> str:
    """getListEventNameClass da MarketUP: quitada, hoje, a vencer, vencida (+ parcial)."""
    if titulo.cancelada:
        return "cancelada"
    if titulo.saldo < Decimal("0.009"):
        return "quitada"
    dias = (titulo.vencimento - timezone.localdate()).days
    base = "hoje" if dias == 0 else ("a_vencer" if dias > 0 else "vencida")
    return f"{base}_parcial" if titulo.saldo != titulo.valor else base


# ---- API ----


class BaixaSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    data = serializers.DateField()
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    juros = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=ZERO)
    desconto = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, default=ZERO)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    conta_corrente = serializers.PrimaryKeyRelatedField(
        queryset=ContaCorrente.objects.filter(ativo=True),
        error_messages={"required": "Informe a conta corrente onde o valor entrou.", "null": "Informe a conta corrente onde o valor entrou."},
    )
    observacao = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


def baixa_para_json(b) -> dict:
    return {
        "id": b.id, "data": b.data, "valor": f"{b.valor:.2f}", "desconto": f"{b.desconto:.2f}", "juros": f"{b.juros:.2f}",
        "amortizado": f"{b.amortizado:.2f}", "tipo_pagamento": b.tipo_pagamento_id,
        "tipo_pagamento_nome": b.tipo_pagamento.descricao if b.tipo_pagamento_id else None,
        "conta_corrente": b.conta_corrente_id, "conta_corrente_nome": b.conta_corrente.nome if b.conta_corrente_id else None,
        "observacao": b.observacao,
    }


class TituloSerializer(serializers.ModelSerializer):
    conta_gerencial_nome = serializers.CharField(source="conta_gerencial.nome", default=None, read_only=True)
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", default=None, read_only=True)
    origem_nome = serializers.CharField(source="get_origem_display", read_only=True)
    situacao = serializers.SerializerMethodField()
    pessoa_nome = serializers.SerializerMethodField()
    baixas = serializers.SerializerMethodField()
    novas_baixas = BaixaSerializer(many=True, required=False, write_only=True)
    manter_baixas = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    repetir = serializers.IntegerField(required=False, min_value=0, max_value=11, write_only=True, default=0)

    CAMPOS = [
        "id", "origem", "origem_nome", "origem_id", "manual", "conta_gerencial", "conta_gerencial_nome", "tipo_pagamento",
        "tipo_pagamento_nome", "descricao", "documento", "codigo_barras", "observacao", "parcela", "parcelas", "emissao",
        "vencimento", "valor", "saldo", "cancelada", "situacao", "pessoa_nome", "baixas", "novas_baixas", "manter_baixas",
        "repetir", "criado_em", "atualizado_em",
    ]
    SOMENTE_LEITURA = ["origem", "origem_id", "manual", "saldo", "cancelada", "parcela", "parcelas", "criado_em", "atualizado_em"]

    def get_situacao(self, titulo):
        return situacao(titulo)

    def get_baixas(self, titulo):
        return [baixa_para_json(b) for b in getattr(titulo, lado_de(titulo).baixas).all()]

    def validate(self, attrs):
        titulo = self.instance
        if titulo and titulo.cancelada:
            raise serializers.ValidationError({"detail": "Conta cancelada não pode ser alterada."})
        if titulo:
            tem_baixa = getattr(titulo, lado_de(titulo).baixas).exists()
            # hasEntry: valor, emissão e vencimento travam com baixa; hasOrigin: descrição e pessoa travam se veio de documento.
            if tem_baixa:
                for campo in ("valor", "emissao", "vencimento"):
                    if campo in attrs and attrs[campo] != getattr(titulo, campo):
                        raise serializers.ValidationError({campo: "Não pode mudar depois do primeiro recebimento/pagamento."})
            if not titulo.manual:
                for campo in ("descricao", "cliente", "funcionario", "fornecedor", "valor"):
                    if campo in attrs and attrs[campo] != getattr(titulo, campo, None):
                        raise serializers.ValidationError({campo: "Esta conta veio de um documento: altere no documento de origem."})
        valor = attrs.get("valor", getattr(titulo, "valor", None))
        if valor is None or valor <= 0:
            raise serializers.ValidationError({"valor": "Informe o valor total."})
        if not attrs.get("descricao", getattr(titulo, "descricao", "")):
            raise serializers.ValidationError({"descricao": "Informe a descrição."})
        manual = titulo is None or titulo.manual
        if manual and not attrs.get("conta_gerencial", getattr(titulo, "conta_gerencial", None)):
            raise serializers.ValidationError({"conta_gerencial": "Escolha a classificação."})
        emissao = attrs.get("emissao", getattr(titulo, "emissao", None))
        vencimento = attrs.get("vencimento", getattr(titulo, "vencimento", None))
        if not vencimento:
            raise serializers.ValidationError({"vencimento": "Informe o vencimento."})
        if emissao and vencimento < emissao:
            raise serializers.ValidationError({"vencimento": "O vencimento não pode ser antes da emissão."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lado = self.context["lado"]
        novas = validated_data.pop("novas_baixas", [])
        validated_data.pop("manter_baixas", None)
        repetir = validated_data.pop("repetir", 0)
        usuario = self.context["request"].user
        validated_data.setdefault("emissao", timezone.localdate())
        total = repetir + 1
        primeiro = None
        for n in range(total):
            dados = dict(validated_data)
            dados["vencimento"] = validated_data["vencimento"] + relativedelta(months=n)
            titulo = lado.Titulo.objects.create(
                **dados, origem=lado.origem_manual, manual=True, saldo=dados["valor"], parcela=n + 1, parcelas=total,
                criado_por=usuario, atualizado_por=usuario,
            )
            primeiro = primeiro or titulo
        for baixa in novas:
            criar_baixa(primeiro, baixa, usuario)
        return primeiro

    @transaction.atomic
    def update(self, titulo, validated_data):
        novas = validated_data.pop("novas_baixas", [])
        manter = validated_data.pop("manter_baixas", None)
        validated_data.pop("repetir", None)
        usuario = self.context["request"].user
        titulo = super().update(titulo, {**validated_data, "atualizado_por": usuario})
        if manter is not None:
            for baixa in lado_de(titulo).Baixa.objects.filter(conta=titulo).exclude(pk__in=manter):
                apagar_baixa(baixa)
            titulo.refresh_from_db()
        if hasattr(titulo, "_prefetched_objects_cache"):
            titulo._prefetched_objects_cache = {}
        for baixa in novas:
            criar_baixa(titulo, baixa, usuario)
        if validated_data.get("valor") is not None:
            recalcular_saldo(titulo)
        atualizar_origem(titulo)
        return titulo


class ContaReceberSerializer(TituloSerializer):
    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)

    class Meta:
        model = ContaReceber
        fields = TituloSerializer.CAMPOS + ["cliente", "cliente_nome", "parcela_pedido"]
        read_only_fields = TituloSerializer.SOMENTE_LEITURA + ["parcela_pedido"]

    def get_pessoa_nome(self, titulo):
        return titulo.cliente.nome if titulo.cliente_id else ""


class ContaPagarSerializer(TituloSerializer):
    funcionario_nome = serializers.CharField(source="funcionario.nome", default=None, read_only=True)
    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", default=None, read_only=True)

    class Meta:
        model = ContaPagar
        fields = TituloSerializer.CAMPOS + ["fornecedor", "fornecedor_nome", "funcionario", "funcionario_nome", "cliente", "cliente_nome", "beneficiario_nome"]
        read_only_fields = TituloSerializer.SOMENTE_LEITURA

    def validate(self, attrs):
        # Um beneficiário só (busca de fornecedor, cliente ou funcionário): escolher um limpa os outros.
        escolhidos = [c for c in ("fornecedor", "cliente", "funcionario") if attrs.get(c)]
        if len(escolhidos) > 1:
            raise serializers.ValidationError({"detail": "Escolha um só beneficiário."})
        if escolhidos:
            for c in ("fornecedor", "cliente", "funcionario"):
                if c not in escolhidos and (self.instance is None or self.instance.manual):
                    attrs[c] = None
            attrs["beneficiario_nome"] = ""
        return super().validate(attrs)

    def get_pessoa_nome(self, titulo):
        if titulo.fornecedor_id:
            return titulo.fornecedor.nome
        if titulo.funcionario_id:
            return titulo.funcionario.nome
        if titulo.cliente_id:
            return titulo.cliente.nome
        return titulo.beneficiario_nome


class BaixaVariasSerializer(serializers.Serializer):
    """"Recebimento/Pagamento de múltiplas contas" (revenue/new): uma baixa por conta, quitando o saldo de cada uma."""

    contas = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    data = serializers.DateField()
    conta_corrente = serializers.PrimaryKeyRelatedField(
        queryset=ContaCorrente.objects.filter(ativo=True), error_messages={"required": "Informe a conta corrente.", "null": "Informe a conta corrente."}
    )
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)


class TituloViewSet(viewsets.ModelViewSet):
    """Base das telas Contas a receber e Contas a pagar."""

    permission_classes = [PermissaoFuncionalidade]
    lado: Lado = RECEBER

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "lado": self.lado}

    def get_queryset(self):
        lado = self.lado
        relacionados = ["conta_gerencial", "tipo_pagamento", "cliente"] + ([] if lado.receber else ["funcionario", "fornecedor"])
        queryset = lado.Titulo.objects.select_related(*relacionados).prefetch_related(
            f"{lado.baixas}__tipo_pagamento", f"{lado.baixas}__conta_corrente"
        )
        p = self.request.query_params
        hoje = timezone.localdate()
        if p.get("cancelada") != "true":
            queryset = queryset.filter(cancelada=False)
        if p.get("search"):
            termo = p["search"].strip()
            filtro = Q(descricao__icontains=termo) | Q(cliente__nome__icontains=termo) | Q(documento__icontains=termo)
            if not lado.receber:
                filtro |= (Q(funcionario__nome__icontains=termo) | Q(beneficiario_nome__icontains=termo)
                           | Q(fornecedor__nome__icontains=termo) | Q(fornecedor__apelido__icontains=termo))
            if termo.isdigit():
                filtro |= Q(pk=int(termo)) | Q(origem_id=int(termo))
            queryset = queryset.filter(filtro)
        # Filtros da MarketUP: Vencimento (Vencidas / A vencer), Status (quitadas / Em aberto), Conta gerencial,
        # Tipo de pagamento, Data de vencimento (de/até).
        if p.get("vencidas") == "1":
            queryset = queryset.filter(vencimento__lt=hoje, saldo__gt=0)
        elif p.get("vencidas") == "0":
            queryset = queryset.filter(vencimento__gte=hoje)
        if p.get("quitadas") == "1":
            queryset = queryset.filter(saldo__lte=0)
        elif p.get("quitadas") == "0":
            queryset = queryset.filter(saldo__gt=0)
        for campo in ("conta_gerencial", "tipo_pagamento", "origem", "origem_id", "cliente", "funcionario", "fornecedor"):
            if p.get(campo):
                queryset = queryset.filter(**{campo: p[campo]})
        if p.get("vencimento_de"):
            queryset = queryset.filter(vencimento__gte=p["vencimento_de"])
        if p.get("vencimento_ate"):
            queryset = queryset.filter(vencimento__lte=p["vencimento_ate"])
        return queryset.order_by("vencimento", "id")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        totais = queryset.aggregate(valor=Sum("valor"), saldo=Sum("saldo"))
        page = self.paginate_queryset(queryset)
        resposta = self.get_paginated_response(self.get_serializer(page, many=True).data)
        resposta.data["total_valor"] = f"{totais['valor'] or ZERO:.2f}"
        resposta.data["total_saldo"] = f"{totais['saldo'] or ZERO:.2f}"
        return resposta

    def perform_destroy(self, titulo):
        # Botão "Cancelar" da MarketUP: só em conta lançada à mão (origem Receitas/Despesas).
        if titulo.origem not in ORIGENS_MANUAIS:
            raise ValidationError({"detail": "Esta conta veio de um documento (pedido, comissão...): cancele pelo documento de origem."})
        titulo.delete()

    @action(detail=False, methods=["post"], url_path="baixar-varias")
    @transaction.atomic
    def baixar_varias(self, request):
        dados = BaixaVariasSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        dados = dados.validated_data
        titulos = list(self.lado.Titulo.objects.select_for_update().filter(pk__in=dados["contas"], cancelada=False, saldo__gt=0))
        if not titulos:
            raise ValidationError({"contas": "Nenhuma conta em aberto entre as escolhidas."})
        for titulo in titulos:
            criar_baixa(titulo, {**dados, "valor": titulo.saldo}, request.user)
            atualizar_origem(titulo)
        return Response({"baixadas": len(titulos), "total": f"{sum((t.valor for t in titulos), ZERO):.2f}"})


class ContaReceberViewSet(TituloViewSet):
    funcionalidade = "contas_receber"
    funcionalidades_leitura = ["pedidos"]
    serializer_class = ContaReceberSerializer
    lado = RECEBER
    queryset = ContaReceber.objects.none()

    @action(detail=True, methods=["get"])
    def recibo(self, request, pk=None):
        conta = self.get_object()
        if conta.valor - conta.saldo <= 0:
            raise ValidationError({"detail": "Esta parcela ainda não tem recebimento."})
        return Response(recibo(conta, request.user))


class ContaPagarViewSet(TituloViewSet):
    funcionalidade = "contas_pagar"
    funcionalidades_leitura = ["comissoes_aprovacao"]
    serializer_class = ContaPagarSerializer
    lado = PAGAR
    queryset = ContaPagar.objects.none()


def referencia_hoje() -> date:
    return timezone.localdate()
