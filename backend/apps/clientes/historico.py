"""
Aba Histórico do cliente (T206): as linhas automáticas de orçamentos e pedidos.

Como a MarketUP faz (clientes 786 e 3141, conferido em 08/11/2026, só leitura):
- `ClientHistoryList` junta as anotações digitadas e uma linha por orçamento e pedido do cliente,
  do mais recente para o mais antigo, em páginas de 5 ("Ver mais registros" → GetClientHistoryPagedList).
- Linha automática: ID −1, "ORÇAMENTO Nº000826" / "PEDIDO Nº002987", status atual do documento em maiúsculas
  (o pedido com o rótulo da listagem: FATURADO, CONCLUÍDO…), só a lupa (sem alterar nem excluir).
- Origem: orçamento −8 (`sale_budget`), pedido 8 (`sale_order`). A OS não entra (decisão do usuário).
As anotações continuam vindo na ficha (campo `historico`) e são gravadas com o Salvar; aqui ficam só as automáticas.
"""

from django.db.models import Prefetch

ORIGEM_ORCAMENTO = -8
ORIGEM_PEDIDO = 8


def documentos_do_cliente(cliente_id: int) -> list[dict]:
    """Orçamentos e pedidos do cliente, do mais recente para o mais antigo."""
    from apps.financeiro.models import ContaReceber
    from apps.vendas.models import Orcamento, ParcelaPedido, Pedido
    from apps.vendas.serializers import situacoes

    linhas = []
    for o in Orcamento.objects.filter(cliente_id=cliente_id).only("id", "status", "emissao", "criado_em"):
        linhas.append({
            "origem": "orcamento", "origem_id": ORIGEM_ORCAMENTO, "chave": o.id, "data": o.emissao, "_ordem": o.criado_em,
            "descricao": f"ORÇAMENTO Nº{o.id:06d}", "status": o.get_status_display().upper(),
        })
    pedidos = Pedido.objects.filter(cliente_id=cliente_id).prefetch_related(
        "itens",
        Prefetch("parcelas", queryset=ParcelaPedido.objects.prefetch_related(
            Prefetch("contas", queryset=ContaReceber.objects.only("id", "saldo", "vencimento", "cancelada", "parcela_pedido_id"))
        )),
    )
    rotulos = {"novo": "NOVO", "faturado": "FATURADO", "concluido": "CONCLUÍDO", "cancelado": "CANCELADO"}
    for p in pedidos:
        linhas.append({
            "origem": "pedido", "origem_id": ORIGEM_PEDIDO, "chave": p.id, "data": p.emissao, "_ordem": p.criado_em,
            "descricao": f"PEDIDO Nº{p.id:06d}", "status": rotulos[situacoes(p)["situacao"]],
        })
    linhas.sort(key=lambda x: (x["data"], x["_ordem"]), reverse=True)
    for linha in linhas:
        del linha["_ordem"]
    return linhas
