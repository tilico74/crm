"""
Movimentação de caixa e Fluxo de caixa (T302), no modelo da MarketUP (cash_movement / cash_flow).
Regras em context/marketup/telas-e-entidades.md, seção "Financeiro (T302)".

Movimentação:
- Lista os movimentos (LancamentoCaixa) do período, agrupados por data; crédito positivo, débito negativo.
- Saldo do período = soma do que está filtrado; saldo atual = tudo até hoje (da conta filtrada, se houver).
- Lançamento avulso (Adicionar novo) = título já quitado (origem 3 Receitas / 2 Despesas, manual) + a baixa.
- Transferência = saída na conta de origem + entrada na de destino (contas gerenciais "Transferência" 35 e 54).
- Excluir um movimento manual apaga o que o gerou (o título avulso, a baixa ou a transferência).

Fluxo de caixa (conferido com os números da RDX em 09/11/2026):
- Até hoje: realizado (movimentos). Depois de hoje: previsto (títulos em aberto pelo vencimento).
- Saldo inicial de período que começa no futuro = saldo realizado até hoje − contas a pagar vencidas em aberto
  + contas a receber vencidas em aberto + previsto entre amanhã e o dia anterior ao início.
- Receita: Operacionais (grupo DRE "Entradas") e Não operacionais; Despesa: pelo grupo do DRE; dentro, conta gerencial e títulos.
"""

from collections import OrderedDict
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

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
    Transferencia,
)
from .recebimentos import PAGAR, RECEBER, apagar_baixa, atualizar_origem, criar_baixa

ZERO = Decimal(0)
TRANSFERENCIA_SAIDA, TRANSFERENCIA_ENTRADA = 35, 54
DRE_NOMES = OrderedDict(
    [
        ("entradas", "Entradas"), ("receitas_financeiras", "Receitas financeiras"), ("impostos_devolucoes", "Impostos e Devoluções"),
        ("custo_mercadoria", "Custo da Mercadoria"), ("gerais_administrativas", "Gerais e Administrativas"),
        ("aluguel", "Aluguel, Condomínio e IPTU"), ("propaganda_marketing", "Propaganda e Marketing"), ("pessoal", "Pessoal"),
        ("pro_labore", "Pro labore"), ("utilidades", "Utilidades"), ("despesas_financeiras", "Despesas financeiras"),
    ]
)


def _data(valor, campo, padrao=None):
    if not valor:
        return padrao
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise ValidationError({campo: "Data inválida. Use AAAA-MM-DD."})


def assinado(lancamento) -> Decimal:
    return lancamento.valor if lancamento.credito else -lancamento.valor


def saldo_ate(dia: date, conta_corrente=None) -> Decimal:
    """Saldo realizado das contas correntes até o fim do dia (crédito − débito)."""
    consulta = LancamentoCaixa.objects.filter(data__lte=dia)
    if conta_corrente:
        consulta = consulta.filter(conta_corrente=conta_corrente)
    credito = consulta.filter(credito=True).aggregate(s=Sum("valor"))["s"] or ZERO
    debito = consulta.filter(credito=False).aggregate(s=Sum("valor"))["s"] or ZERO
    return credito - debito


# ---- Movimentação de caixa ----


def movimento_json(m) -> dict:
    return {
        "id": m.id, "data": m.data, "conta_corrente": m.conta_corrente_id, "conta_corrente_nome": m.conta_corrente.nome if m.conta_corrente_id else "",
        "descricao": m.descricao, "manual": m.manual, "tipo_pagamento": m.tipo_pagamento_id,
        "tipo_pagamento_nome": m.tipo_pagamento.descricao if m.tipo_pagamento_id else "", "credito": m.credito,
        "valor": f"{assinado(m):.2f}", "conta_gerencial": m.conta_gerencial_id,
        "conta_receber": m.conta_receber_id, "conta_pagar": m.conta_pagar_id, "transferencia": m.transferencia_id,
    }


class LancamentoAvulsoSerializer(serializers.Serializer):
    """Modal "Lançamento" da MarketUP: Pagamento/Recebimento, classificação, data, conta, valor, forma e descrição."""

    credito = serializers.BooleanField()
    conta_gerencial = serializers.PrimaryKeyRelatedField(queryset=ContaGerencial.objects.all(), error_messages={"required": "Escolha a classificação.", "null": "Escolha a classificação."})
    data = serializers.DateField()
    conta_corrente = serializers.PrimaryKeyRelatedField(queryset=ContaCorrente.objects.filter(ativo=True), error_messages={"required": "Informe a conta corrente.", "null": "Informe a conta corrente."})
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    tipo_pagamento = serializers.PrimaryKeyRelatedField(queryset=TipoPagamento.objects.all(), required=False, allow_null=True)
    descricao = serializers.CharField(max_length=300)

    def validate_valor(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("Informe um valor maior que zero.")
        return valor


class TransferenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transferencia
        fields = ["id", "data", "conta_origem", "conta_destino", "documento", "valor", "tipo_pagamento", "observacao"]

    def validate(self, attrs):
        if attrs["conta_origem"] == attrs["conta_destino"]:
            raise serializers.ValidationError({"conta_destino": "Escolha uma conta de destino diferente da de origem."})
        if attrs["valor"] <= 0:
            raise serializers.ValidationError({"valor": "Informe um valor maior que zero."})
        return attrs


def gravar_transferencia(transferencia, usuario):
    transferencia.lancamentos.all().delete()
    texto = transferencia.observacao or "Transferência entre contas"
    for conta, credito, gerencial in (
        (transferencia.conta_origem, False, TRANSFERENCIA_SAIDA), (transferencia.conta_destino, True, TRANSFERENCIA_ENTRADA)
    ):
        LancamentoCaixa.objects.create(
            data=transferencia.data, conta_corrente=conta, tipo_pagamento=transferencia.tipo_pagamento, credito=credito,
            valor=transferencia.valor, descricao=f"TRANSFERÊNCIA - {texto}".upper(), manual=True,
            conta_gerencial=ContaGerencial.objects.filter(pk=gerencial).first(), transferencia=transferencia,
            origem=OrigemFinanceira.RECEITAS if credito else OrigemFinanceira.DESPESAS, criado_por=usuario, atualizado_por=usuario,
        )


class MovimentacaoView(APIView):
    """GET lista do período · POST lançamento avulso · DELETE ?id= exclui movimento manual."""

    funcionalidade = "movimentacao_caixa"
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        p = request.query_params
        hoje = timezone.localdate()
        de = _data(p.get("de"), "de", hoje - timedelta(days=7))
        ate = _data(p.get("ate"), "ate", hoje)
        consulta = LancamentoCaixa.objects.filter(data__gte=de, data__lte=ate).select_related("conta_corrente", "tipo_pagamento")
        if p.get("conta_corrente"):
            consulta = consulta.filter(conta_corrente_id=p["conta_corrente"])
        if p.get("conta_gerencial"):
            consulta = consulta.filter(conta_gerencial_id=p["conta_gerencial"])
        if p.get("tipo_pagamento"):
            consulta = consulta.filter(tipo_pagamento_id=p["tipo_pagamento"])
        if p.get("tipo") in ("1", "-1"):
            consulta = consulta.filter(credito=p["tipo"] == "1")
        if p.get("valor_de"):
            consulta = consulta.filter(valor__gte=p["valor_de"])
        if p.get("valor_ate"):
            consulta = consulta.filter(valor__lte=p["valor_ate"])
        movimentos = list(consulta.order_by("data", "id"))
        return Response({
            "de": de, "ate": ate,
            "saldo_periodo": f"{sum((assinado(m) for m in movimentos), ZERO):.2f}",
            "saldo_atual": f"{saldo_ate(hoje, p.get('conta_corrente')):.2f}",
            "results": [movimento_json(m) for m in movimentos],
        })

    @transaction.atomic
    def post(self, request):
        dados = LancamentoAvulsoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        d = dados.validated_data
        lado = RECEBER if d["credito"] else PAGAR
        titulo = lado.Titulo.objects.create(
            origem=lado.origem_manual, manual=True, conta_gerencial=d["conta_gerencial"], tipo_pagamento=d.get("tipo_pagamento"),
            descricao=d["descricao"], emissao=d["data"], vencimento=d["data"], valor=d["valor"], saldo=d["valor"],
            criado_por=request.user, atualizado_por=request.user,
        )
        baixa = criar_baixa(titulo, {"data": d["data"], "valor": d["valor"], "conta_corrente": d["conta_corrente"], "tipo_pagamento": d.get("tipo_pagamento")}, request.user)
        return Response(movimento_json(LancamentoCaixa.objects.get(pk=baixa.lancamento_id)), status=201)

    @transaction.atomic
    def delete(self, request):
        movimento = LancamentoCaixa.objects.filter(pk=request.query_params.get("id")).first()
        if not movimento:
            raise ValidationError({"detail": "Movimento não encontrado."})
        if not movimento.manual:
            raise ValidationError({"detail": "Movimento automático (de pedido, comissão...): exclua o recebimento ou pagamento na conta de origem."})
        if movimento.transferencia_id:
            movimento.transferencia.delete()
            return Response(status=204)
        titulo = movimento.conta_receber or movimento.conta_pagar
        if titulo is None:
            movimento.delete()
            return Response(status=204)
        lado = RECEBER if movimento.conta_receber_id else PAGAR
        baixa = lado.Baixa.objects.filter(lancamento=movimento).first()
        baixas = getattr(titulo, lado.baixas).count()
        # Lançamento avulso (título quitado na hora, uma baixa só): sai o título inteiro, como na MarketUP.
        if titulo.manual and baixas <= 1 and titulo.vencimento == titulo.emissao == movimento.data:
            titulo.delete()
        elif baixa:
            apagar_baixa(baixa)
            atualizar_origem(titulo)
        else:
            movimento.delete()
        return Response(status=204)


class TransferenciaView(APIView):
    """Nova transferência (POST) e alteração (PUT ?id=)."""

    funcionalidade = "movimentacao_caixa"
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        t = Transferencia.objects.filter(pk=request.query_params.get("id")).first()
        if not t:
            raise ValidationError({"detail": "Transferência não encontrada."})
        return Response(TransferenciaSerializer(t).data)

    @transaction.atomic
    def post(self, request):
        dados = TransferenciaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        t = dados.save(criado_por=request.user, atualizado_por=request.user)
        gravar_transferencia(t, request.user)
        return Response(TransferenciaSerializer(t).data, status=201)

    @transaction.atomic
    def put(self, request):
        t = Transferencia.objects.filter(pk=request.query_params.get("id")).first()
        if not t:
            raise ValidationError({"detail": "Transferência não encontrada."})
        dados = TransferenciaSerializer(t, data=request.data)
        dados.is_valid(raise_exception=True)
        t = dados.save(atualizado_por=request.user)
        gravar_transferencia(t, request.user)
        return Response(TransferenciaSerializer(t).data)


# ---- Fluxo de caixa ----


def _colunas(de: date, ate: date, dias: bool) -> list[tuple[date, date, str, str]]:
    colunas = []
    if dias:
        dia = de
        while dia <= ate:
            colunas.append((dia, dia, dia.strftime("%d/%m"), ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][dia.weekday()]))
            dia += timedelta(days=1)
        return colunas
    meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    inicio = de
    while inicio <= ate:
        proximo = date(inicio.year + (inicio.month == 12), inicio.month % 12 + 1, 1)
        fim = min(ate, proximo - timedelta(days=1))
        colunas.append((inicio, fim, str(inicio.year), meses[inicio.month - 1]))
        inicio = proximo
    return colunas


def _abertos(modelo, ate_dia: date, de_dia: date | None = None, conta_corrente=None):
    """Títulos em aberto (previsto) com vencimento no intervalo."""
    if conta_corrente:  # previsto não tem conta corrente ainda: com conta filtrada, só o realizado
        return modelo.objects.none()
    consulta = modelo.objects.filter(cancelada=False, saldo__gt=0, vencimento__lte=ate_dia)
    if de_dia:
        consulta = consulta.filter(vencimento__gte=de_dia)
    return consulta


class FluxoCaixaView(APIView):
    """Fluxo de caixa: ?de=&ate=&conta_corrente=&visao=dias|meses."""

    funcionalidade = "fluxo_caixa"
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        p = request.query_params
        hoje = timezone.localdate()
        de = _data(p.get("de"), "de", hoje - timedelta(days=6))
        ate = _data(p.get("ate"), "ate", hoje)
        if ate < de:
            raise ValidationError({"ate": "A data final é antes da inicial."})
        dias = p.get("visao") == "dias"
        if dias and (ate - de).days > 62:
            raise ValidationError({"visao": "Na visão por dias, escolha um período de até 2 meses."})
        conta = p.get("conta_corrente") or None
        colunas = _colunas(de, ate, dias)

        # Saldo inicial: realizado até a véspera; se o período começa depois de amanhã, entra o previsto até lá.
        vespera = de - timedelta(days=1)
        if vespera <= hoje:
            inicial = saldo_ate(vespera, conta)
        else:
            inicial = saldo_ate(hoje, conta)
            inicial += sum((t.saldo for t in _abertos(ContaReceber, vespera, conta_corrente=conta)), ZERO)
            inicial -= sum((t.saldo for t in _abertos(ContaPagar, vespera, conta_corrente=conta)), ZERO)

        # Itens do período: (data efetiva, valor assinado, conta gerencial, descrição, pessoa, título)
        itens = []
        realizados = LancamentoCaixa.objects.filter(data__gte=de, data__lte=min(ate, hoje)).select_related(
            "conta_gerencial", "conta_receber__cliente", "conta_pagar__funcionario", "conta_pagar__cliente"
        )
        if conta:
            realizados = realizados.filter(conta_corrente_id=conta)
        for m in realizados:
            if not conta and m.transferencia_id:
                continue  # transferência entre contas: no consolidado, entra e sai (soma zero)
            titulo = m.conta_receber or m.conta_pagar
            pessoa = ""
            if m.conta_receber_id and m.conta_receber.cliente_id:
                pessoa = m.conta_receber.cliente.nome
            elif m.conta_pagar_id:
                cp = m.conta_pagar
                pessoa = cp.funcionario.nome if cp.funcionario_id else (cp.cliente.nome if cp.cliente_id else cp.beneficiario_nome)
            itens.append((m.data, assinado(m), m.conta_gerencial, titulo.descricao if titulo else m.descricao, pessoa or "Não informado", titulo.id if titulo else None))
        if ate > hoje:
            amanha = max(de, hoje + timedelta(days=1))
            for modelo, sinal in ((ContaReceber, 1), (ContaPagar, -1)):
                for t in _abertos(modelo, ate, amanha, conta).select_related("conta_gerencial"):
                    pessoa = getattr(t, "cliente", None)
                    nome = pessoa.nome if pessoa else (getattr(t, "beneficiario_nome", "") or "Não informado")
                    itens.append((t.vencimento, sinal * t.saldo, t.conta_gerencial, t.descricao, nome, t.id))
            # Começando hoje ou antes e indo além: o vencido em aberto entra no primeiro dia previsto (como a MarketUP).
            if de <= hoje:
                vencido = sum((t.saldo for t in _abertos(ContaReceber, hoje, conta_corrente=conta)), ZERO) - sum(
                    (t.saldo for t in _abertos(ContaPagar, hoje, conta_corrente=conta)), ZERO
                )
                if vencido:
                    itens.append((amanha, vencido, None, "Vencidos em aberto (inadimplência e endividamento)", "", None))

        def coluna_de(dia):
            for n, (ini, fim, _, _) in enumerate(colunas):
                if ini <= dia <= fim:
                    return n
            return None

        # Árvore: Receita/Despesa → grupo → conta gerencial → títulos.
        arvore = {"receita": OrderedDict(), "despesa": OrderedDict()}
        totais = {"receita": [ZERO] * len(colunas), "despesa": [ZERO] * len(colunas)}
        for dia, valor, gerencial, descricao, pessoa, titulo_id in itens:
            n = coluna_de(dia)
            if n is None:
                continue
            lado = "receita" if valor > 0 else "despesa"
            if gerencial is None:
                grupo, conta_nome = "Outros", "Sem classificação"
            elif lado == "receita":
                grupo = "Operacionais" if gerencial.classificacao_dre == "entradas" else "Não operacionais"
                conta_nome = gerencial.nome
            else:
                grupo = DRE_NOMES.get(gerencial.classificacao_dre, "Outras despesas")
                conta_nome = gerencial.nome
            g = arvore[lado].setdefault(grupo, OrderedDict())
            c = g.setdefault(conta_nome, {"valores": [ZERO] * len(colunas), "titulos": OrderedDict()})
            c["valores"][n] += valor
            chave = (titulo_id, descricao)
            t = c["titulos"].setdefault(chave, {"descricao": descricao, "pessoa": pessoa, "titulo": titulo_id, "valores": [ZERO] * len(colunas)})
            t["valores"][n] += valor
            totais[lado][n] += valor

        def fmt(lista):
            return [f"{v:.2f}" for v in lista]

        def ramo(lado):
            return [
                {
                    "nome": grupo,
                    "valores": fmt([sum((c["valores"][i] for c in contas.values()), ZERO) for i in range(len(colunas))]),
                    "contas": [
                        {"nome": nome, "valores": fmt(c["valores"]), "titulos": [{**t, "valores": fmt(t["valores"])} for t in c["titulos"].values()]}
                        for nome, c in contas.items()
                    ],
                }
                for grupo, contas in arvore[lado].items()
            ]

        iniciais, finais = [], []
        saldo = inicial
        for i in range(len(colunas)):
            iniciais.append(saldo)
            saldo = saldo + totais["receita"][i] + totais["despesa"][i]
            finais.append(saldo)

        # Cards da MarketUP: inadimplência (a receber vencido) e endividamento (a pagar vencido), com a variação em 30 dias.
        def vencidos(modelo, ate_dia):
            consulta = modelo.objects.filter(cancelada=False, saldo__gt=0, vencimento__lt=ate_dia)
            return consulta.count(), consulta.aggregate(s=Sum("saldo"))["s"] or ZERO

        def card(modelo):
            qtd, total = vencidos(modelo, hoje)
            _, antes = vencidos(modelo, hoje - timedelta(days=30))
            crescimento = ((total - antes) / antes * 100).quantize(Decimal("0.01")) if antes else None
            return {"total": f"{total:.2f}", "quantidade": qtd, "crescimento": f"{crescimento}" if crescimento is not None else None}

        return Response({
            "de": de, "ate": ate, "visao": "dias" if dias else "meses", "hoje": hoje,
            "colunas": [{"inicio": a, "fim": b, "titulo": t, "subtitulo": s, "previsto": a > hoje} for a, b, t, s in colunas],
            "saldo_inicial": fmt(iniciais),
            "receita": {"valores": fmt(totais["receita"]), "grupos": ramo("receita")},
            "despesa": {"valores": fmt(totais["despesa"]), "grupos": ramo("despesa")},
            "saldo_final": fmt(finais),
            "inadimplencia": card(ContaReceber),
            "endividamento": card(ContaPagar),
        })
