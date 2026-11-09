"""
Regras das comissões (decididas pelo usuário em 09/11/2026, seguindo a MarketUP):
- Só vendedores. Nasce sozinha ao concluir o pedido (tipo Automático), com o % do vendedor (Funcionario.comissao).
- Base = total do pedido (já com o desconto) **menos o frete** (frete não entra na comissão).
- Comissão = round(base × % ÷ 100, 2); % ≤ 0 → 0; a comissão não passa o valor da venda.
- Pedido cancelado: comissão ainda não fechada é apagada; já fechada → estorno negativo para o próximo fechamento.
- Fechamento (aprovação): quem aprova é o gerente (permissão "Aprovação de comissões"); ninguém aprova a própria
  comissão. Gera uma conta a pagar por vendedor, na conta gerencial "Comissão de vendas" (se existir).
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from .models import Comissao, FechamentoComissao

CENTAVO = Decimal("0.01")


def dinheiro(valor) -> Decimal:
    return Decimal(valor or 0).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def calcular(valor_venda, percentual) -> Decimal:
    """calculateCommissionValue da MarketUP."""
    percentual = Decimal(percentual or 0)
    if percentual <= 0:
        return Decimal("0.00")
    return dinheiro(Decimal(valor_venda) * percentual / 100)


def base_do_pedido(pedido) -> Decimal:
    """Total do pedido (com desconto) sem o frete."""
    return dinheiro(pedido.total - pedido.frete)


def gerar_do_pedido(pedido, usuario=None) -> Comissao | None:
    """Comissão automática do pedido concluído (uma só por pedido)."""
    vendedor = pedido.vendedor
    if not vendedor or Comissao.objects.filter(pedido=pedido, tipo=Comissao.Tipo.AUTOMATICO, estorno_de__isnull=True).exists():
        return None
    base = base_do_pedido(pedido)
    return Comissao.objects.create(
        tipo=Comissao.Tipo.AUTOMATICO, vendedor=vendedor, pedido=pedido, emissao=pedido.emissao,
        valor_venda=base, percentual=vendedor.comissao, valor=calcular(base, vendedor.comissao),
        criado_por=usuario, atualizado_por=usuario,
    )


def estornar_do_pedido(pedido, usuario=None):
    """Pedido cancelado: apaga as comissões em aberto e estorna as já fechadas."""
    from django.utils import timezone

    for comissao in Comissao.objects.filter(pedido=pedido, estorno_de__isnull=True, valor__gte=0):
        if comissao.fechamento_id is None:
            comissao.delete()
        elif not Comissao.objects.filter(estorno_de=comissao).exists():
            Comissao.objects.create(
                tipo=comissao.tipo, vendedor=comissao.vendedor, pedido=pedido, emissao=timezone.localdate(),
                estorno_de=comissao, observacao=f"Estorno: pedido Nº {pedido.id} cancelado depois do fechamento {comissao.fechamento_id}",
                valor_venda=-comissao.valor_venda, percentual=comissao.percentual, valor=-comissao.valor,
                criado_por=usuario, atualizado_por=usuario,
            )


@transaction.atomic
def fechar(comissoes_ids: list[int], data, descricao: str, usuario) -> FechamentoComissao:
    """Aprovação de comissões: fecha os lançamentos e gera uma conta a pagar por vendedor."""
    from apps.financeiro.models import ContaGerencial, ContaPagar

    comissoes = list(Comissao.objects.select_for_update().filter(pk__in=comissoes_ids).select_related("vendedor"))
    if not comissoes or len(comissoes) != len(set(comissoes_ids)):
        raise ValidationError({"comissoes": "Escolha os lançamentos a fechar."})
    if any(c.fechamento_id for c in comissoes):
        raise ValidationError({"comissoes": "Há lançamentos já fechados na seleção."})
    proprio = getattr(usuario, "funcionario", None)
    if proprio and any(c.vendedor_id == proprio.id for c in comissoes):
        raise ValidationError({"comissoes": "Você não pode aprovar a própria comissão: quem aprova é o gerente."})
    total = sum((c.valor for c in comissoes), Decimal(0))
    fechamento = FechamentoComissao.objects.create(
        data=data, descricao=descricao or "", valor_total=total, criado_por=usuario, atualizado_por=usuario
    )
    Comissao.objects.filter(pk__in=[c.pk for c in comissoes]).update(fechamento=fechamento)
    conta_gerencial = ContaGerencial.objects.filter(nome__iexact="Comissão de vendas").first()
    por_vendedor: dict = {}
    for c in comissoes:
        por_vendedor.setdefault(c.vendedor, Decimal(0))
        por_vendedor[c.vendedor] += c.valor
    for vendedor, valor in por_vendedor.items():
        if valor <= 0:
            continue  # só estornos/zeros: nada a pagar
        ContaPagar.objects.create(
            origem=ContaPagar.Origem.COMISSAO, origem_id=fechamento.id, funcionario=vendedor, conta_gerencial=conta_gerencial,
            descricao=f"Comissão de vendas - fechamento Nº {fechamento.id} - {vendedor.nome}",
            emissao=data, vencimento=data, valor=valor, saldo=valor, criado_por=usuario, atualizado_por=usuario,
        )
    return fechamento


@transaction.atomic
def desfazer(fechamento: FechamentoComissao, usuario):
    """Desfaz o fechamento: os lançamentos voltam a ficar em aberto e as contas a pagar são canceladas."""
    from apps.financeiro.models import ContaPagar

    contas = ContaPagar.objects.filter(origem=ContaPagar.Origem.COMISSAO, origem_id=fechamento.id, cancelada=False)
    if contas.filter(saldo__lt=F("valor")).exists():
        raise ValidationError({"detail": "Já houve pagamento deste fechamento. Estorne o pagamento antes de desfazer."})
    contas.update(cancelada=True)
    fechamento.comissoes.update(fechamento=None)
    fechamento.delete()
