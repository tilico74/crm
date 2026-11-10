"""
Regras do estoque (T301), como a MarketUP:
- Só produto com "movimentar estoque" entra no saldo (os 190 produtos da RDX vieram com isso desligado).
- Entrada soma no local de destino; saída tira do local de origem; transferência faz os dois (origem ≠ destino).
- Movimentação precisa de pelo menos um item; saída pode ter motivo e "perda e avaria".
- Local com inventário em andamento não movimenta ("Não será possível movimentar o local de estoque durante o inventário").
- Movimentos automáticos: entrega do pedido de venda (saída, origem 1), cancelamento/devolução (entrada, origens 6/7),
  recebimento de compra (entrada, origem 4), cancelamento/devolução de compra (saída, origens 10/11).
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Inventario, ItemInventario, ItemMovimentacao, LocalEstoque, Movimentacao, Saldo

ZERO = Decimal(0)


def checar_inventario(*locais):
    for local in locais:
        if local and Inventario.objects.filter(local=local, status=Inventario.Status.ABERTO).exists():
            raise ValidationError({"detail": f"O local \"{local.nome}\" está em inventário: não é possível movimentá-lo até concluir ou cancelar o inventário."})


def _somar(produto, local, quantidade):
    saldo, _ = Saldo.objects.select_for_update().get_or_create(produto=produto, local=local)
    Saldo.objects.filter(pk=saldo.pk).update(quantidade=F("quantidade") + quantidade)


@transaction.atomic
def registrar(*, tipo, itens: list[dict], usuario=None, data=None, local_origem=None, local_destino=None, origem=None, origem_id=None,
              manual=True, ignorar_inventario=False, **extras) -> Movimentacao:
    """
    Cria a movimentação e atualiza os saldos. `itens`: produto, quantidade, unidade?, valor_unitario?, lote?, fabricacao?, validade?.
    Itens de produto que não movimenta estoque são ignorados (sem eles, nada é gravado e devolve None).
    """
    itens = [i for i in itens if getattr(i["produto"], "movimenta_estoque", False) and Decimal(i["quantidade"]) != 0]
    if not itens:
        if manual:
            raise ValidationError({"itens": "A movimentação deve conter pelo menos um item que movimenta estoque."})
        return None
    if tipo == Movimentacao.Tipo.TRANSFERENCIA:
        if not local_origem or not local_destino:
            raise ValidationError({"local_destino": "Informe o local de origem e o de destino."})
        if local_origem == local_destino:
            raise ValidationError({"local_destino": "O estoque de origem não pode ser igual ao estoque de destino."})
    if tipo in (Movimentacao.Tipo.SAIDA, Movimentacao.Tipo.TRANSFERENCIA) and not local_origem:
        raise ValidationError({"local_origem": "Informe o local de estoque de origem."})
    if tipo == Movimentacao.Tipo.ENTRADA and not local_destino:
        raise ValidationError({"local_destino": "Informe o local de estoque de destino."})
    if tipo != Movimentacao.Tipo.SAIDA:
        extras["motivo"] = None
        extras["perda_avaria"] = False
    if not ignorar_inventario:
        checar_inventario(local_origem, local_destino)
    total_q = sum((Decimal(i["quantidade"]) for i in itens), ZERO)
    total_v = sum((Decimal(i["quantidade"]) * Decimal(i.get("valor_unitario") or 0) for i in itens), ZERO)
    mov = Movimentacao.objects.create(
        tipo=tipo, origem=origem, origem_id=origem_id, data=data or timezone.localdate(), local_origem=local_origem,
        local_destino=local_destino, manual=manual, total_quantidade=total_q, total_valor=total_v.quantize(Decimal("0.01")),
        criado_por=usuario, atualizado_por=usuario, **extras,
    )
    for i in itens:
        q = Decimal(i["quantidade"])
        ItemMovimentacao.objects.create(
            movimentacao=mov, produto=i["produto"], unidade=i.get("unidade") or i["produto"].unidade, quantidade=q,
            valor_unitario=i.get("valor_unitario") or 0, lote=i.get("lote") or "", fabricacao=i.get("fabricacao"), validade=i.get("validade"),
        )
        if tipo in (Movimentacao.Tipo.ENTRADA,):
            _somar(i["produto"], local_destino, q)
        elif tipo == Movimentacao.Tipo.SAIDA:
            _somar(i["produto"], local_origem, -q)
        elif tipo == Movimentacao.Tipo.TRANSFERENCIA:
            _somar(i["produto"], local_origem, -q)
            _somar(i["produto"], local_destino, q)
        elif tipo == Movimentacao.Tipo.ACERTO:
            # Acerto: quantidade com sinal, aplicada no local de destino.
            _somar(i["produto"], local_destino, q)
    return mov


def saldo(produto, local) -> Decimal:
    s = Saldo.objects.filter(produto=produto, local=local).values_list("quantidade", flat=True).first()
    return s or ZERO


# ---- Pedido de venda ----


def saida_do_pedido(pedido, itens_qtd: list[tuple], usuario=None, data=None, local=None):
    """Entrega do pedido: saída dos produtos que movimentam estoque (origem 1)."""
    local = local or LocalEstoque.padrao_atual()
    from apps.vendas.models import ParametrosVenda

    if ParametrosVenda.atual().bloquear_venda_estoque_negativo:
        for item, q in itens_qtd:
            if item.produto_id and item.produto.movimenta_estoque and saldo(item.produto, local) < q:
                raise ValidationError({"detail": f"Estoque insuficiente de \"{item.descricao}\" em {local.nome} (saldo {saldo(item.produto, local):.3f})."})
    return registrar(
        tipo=Movimentacao.Tipo.SAIDA, origem=Movimentacao.Origem.PEDIDO_VENDA, origem_id=pedido.id, manual=False, usuario=usuario,
        data=data, local_origem=local, pessoa=pedido.cliente.nome if pedido.cliente_id else "",
        itens=[{"produto": item.produto, "quantidade": q, "unidade": item.unidade, "valor_unitario": item.produto.preco_custo} for item, q in itens_qtd if item.produto_id],
    )


def entrada_do_cancelamento(pedido, usuario=None, local=None):
    """Cancelamento do pedido entregue: os itens entregues voltam ao estoque (origem 6)."""
    local = local or LocalEstoque.padrao_atual()
    itens = [(i, i.entregue) for i in pedido.itens.all() if i.produto_id and i.entregue > 0]
    return registrar(
        tipo=Movimentacao.Tipo.ENTRADA, origem=Movimentacao.Origem.CANCELAMENTO_VENDA, origem_id=pedido.id, manual=False, usuario=usuario,
        local_destino=local, pessoa=pedido.cliente.nome if pedido.cliente_id else "",
        itens=[{"produto": i.produto, "quantidade": q, "unidade": i.unidade, "valor_unitario": i.produto.preco_custo} for i, q in itens],
    )


# ---- Consulta (ajuste) e inventário ----


@transaction.atomic
def ajustar(produto, local, nova_quantidade, usuario=None):
    """Editar a quantidade na Consulta de estoque: a diferença vira um acerto."""
    diferenca = Decimal(nova_quantidade) - saldo(produto, local)
    if diferenca == 0:
        return None
    return registrar(
        tipo=Movimentacao.Tipo.ACERTO, origem=Movimentacao.Origem.AJUSTE, manual=True, usuario=usuario, local_destino=local,
        informacoes="Ajuste de saldo pela Consulta de estoque",
        itens=[{"produto": produto, "quantidade": diferenca, "valor_unitario": produto.preco_custo or 0}],
    )


@transaction.atomic
def iniciar_inventario(local, usuario=None) -> Inventario:
    if Inventario.objects.filter(local=local, status=Inventario.Status.ABERTO).exists():
        raise ValidationError({"detail": "Este local já tem um inventário em andamento."})
    inv = Inventario.objects.create(local=local, criado_por=usuario, atualizado_por=usuario)
    for s in Saldo.objects.filter(local=local).exclude(quantidade=0).select_related("produto"):
        ItemInventario.objects.create(inventario=inv, produto=s.produto, quantidade_sistema=s.quantidade)
    return inv


@transaction.atomic
def concluir_inventario(inv: Inventario, contagens: dict, usuario=None) -> Inventario:
    """`contagens`: {produto_id: quantidade contada}. Produto não contado fica como está."""
    from apps.catalogo.models import Produto

    if inv.status != Inventario.Status.ABERTO:
        raise ValidationError({"detail": "Este inventário não está em andamento."})
    itens = []
    for produto_id, contado in contagens.items():
        produto = Produto.objects.get(pk=produto_id)
        atual = saldo(produto, inv.local)
        ItemInventario.objects.update_or_create(
            inventario=inv, produto=produto, defaults={"quantidade_contada": Decimal(contado), "quantidade_sistema": atual}
        )
        if Decimal(contado) != atual:
            itens.append({"produto": produto, "quantidade": Decimal(contado) - atual, "valor_unitario": produto.preco_custo or 0})
    if itens:
        inv.movimentacao = registrar(
            tipo=Movimentacao.Tipo.ACERTO, origem=Movimentacao.Origem.INVENTARIO, origem_id=inv.id, manual=False, usuario=usuario,
            local_destino=inv.local, informacoes=f"Inventário Nº {inv.id}", itens=itens, ignorar_inventario=True,
        )
    inv.status = Inventario.Status.CONCLUIDO
    inv.fim = timezone.now()
    inv.atualizado_por = usuario
    inv.save()
    return inv


def cancelar_inventario(inv: Inventario, usuario=None) -> Inventario:
    if inv.status != Inventario.Status.ABERTO:
        raise ValidationError({"detail": "Este inventário não está em andamento."})
    inv.status = Inventario.Status.CANCELADO
    inv.fim = timezone.now()
    inv.atualizado_por = usuario
    inv.save()
    return inv
