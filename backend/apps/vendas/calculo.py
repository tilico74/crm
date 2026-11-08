"""Cálculos do orçamento (e, na T203, do pedido): totais, descontos e parcelas.

Regras da MarketUP conferidas no orçamento 3874 (08/11/2026):
- Item: subtotal = quantidade × unitário; total = subtotal − desconto do item.
- Orçamento: subtotal = soma dos totais dos itens; total = subtotal − desconto geral + frete + outros custos.
- Desconto em R$ ou em % (botões R$ / %): guarda os dois; o que foi digitado manda.
- Dinheiro sempre em Decimal com 2 casas, arredondando meio para cima.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

CENTAVO = Decimal("0.01")
CEM = Decimal("100")


def dinheiro(valor) -> Decimal:
    return Decimal(valor or 0).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def aplicar_desconto(base: Decimal, desconto, percentual, em_percentual: bool) -> tuple[Decimal, Decimal]:
    """Devolve (desconto em R$, desconto em %) a partir do que foi digitado."""
    base = dinheiro(base)
    if em_percentual:
        pct = Decimal(percentual or 0)
        return dinheiro(base * pct / CEM), pct.quantize(Decimal("0.0001"))
    valor = dinheiro(desconto)
    pct = (valor / base * CEM).quantize(Decimal("0.0001")) if base else Decimal(0)
    return valor, pct


def calcular_item(item: dict) -> dict:
    """Recebe quantidade, valor_unitario e desconto/desconto_percentual/desconto_em_percentual; devolve com os totais."""
    subtotal = dinheiro(Decimal(item["quantidade"]) * Decimal(item["valor_unitario"]))
    desconto, pct = aplicar_desconto(subtotal, item.get("desconto"), item.get("desconto_percentual"), item.get("desconto_em_percentual", False))
    return {**item, "subtotal": subtotal, "desconto": desconto, "desconto_percentual": pct, "total": subtotal - desconto}


def calcular_orcamento(dados: dict, itens: list[dict]) -> dict:
    """Totais do cabeçalho a partir dos itens já calculados."""
    subtotal = sum((i["total"] for i in itens), Decimal(0))
    desconto, pct = aplicar_desconto(subtotal, dados.get("desconto"), dados.get("desconto_percentual"), dados.get("desconto_em_percentual", False))
    frete, outros = dinheiro(dados.get("frete")), dinheiro(dados.get("outros_custos"))
    return {
        "subtotal": dinheiro(subtotal),
        "desconto": desconto,
        "desconto_percentual": pct,
        "frete": frete,
        "outros_custos": outros,
        "total": dinheiro(subtotal) - desconto + frete + outros,
    }


@dataclass
class Parcela:
    numero: int
    quantidade: int
    vencimento: date
    valor: Decimal


def gerar_parcelas(valor, parcelas: int, base: date, primeira_parcela: int = 0, intervalo: int = 0) -> list[Parcela]:
    """
    "Gerar contas": divide o valor nas parcelas da condição de pagamento (regra do `setPayment` da MarketUP).
    - Cada parcela = valor ÷ parcelas, arredondado; a diferença do arredondamento vai para a 1ª
      (ex.: 620,00 em 3x = 206,66 + 206,67 + 206,67).
    - Vencimentos: base (hoje) + dias da 1ª parcela, depois + intervalo; intervalo 0 com mais de
      uma parcela = mensal (30 dias).
    """
    valor = dinheiro(valor)
    parcelas = max(1, int(parcelas))
    passo = intervalo or (30 if parcelas > 1 else 0)
    cada = dinheiro(valor / parcelas)
    sobra = valor - cada * parcelas
    return [
        Parcela(
            numero=n + 1,
            quantidade=parcelas,
            vencimento=base + timedelta(days=primeira_parcela + n * passo),
            valor=cada + (sobra if n == 0 else 0),
        )
        for n in range(parcelas)
    ]
