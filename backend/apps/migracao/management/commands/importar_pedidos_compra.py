"""Carga dos pedidos de compra da MarketUP (T301 etapa 3 / M003), com os IDs da MarketUP.

Fonte: PedidosCompraMarketUP.json, lido em 10/11/2026 da ficha de cada pedido (purchaseOrderGet, só leitura).
Chaves curtas por pedido: id, sup (SupplierID), buy (BuyerID; 0 = sem comprador), st (status), iss/del/bil/can (emissão,
recebimento previsto, faturamento, cancelamento), sub, shp, gd (desconto geral), gdp, tax (outros custos), tot, obs, bud,
inv [InvoiceID, nº, série, emissão], ma (conta gerencial), bA/dA (endereços copiados), items e ins (parcelas).
Itens: id, it (ItemID), un, nm, a (qtd), r (recebido), rt (devolvido), rd, rv, v, d, dp, adp, sub, tot, b (lote), ex (validade), o, ord.
Parcelas: id, dt (vencimento), lp (último pagamento), v, n, c, ds (duplicata), bal (saldo), ev (EventID), pt, pc, g, ma.

Nada vai para o estoque: na MarketUP da RDX nenhum produto movimentava estoque (InStock falso em todos os itens).
As contas a pagar (EventID) entram com a carga do financeiro; até lá o pedido usa o saldo da parcela (saldo_marketup).

Uso: docker compose exec backend python manage.py importar_pedidos_compra /migracao/dados/PedidosCompraMarketUP.json [--simular]
"""

import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.catalogo.models import Produto, Unidade
from apps.compras.models import Fornecedor, ItemPedidoCompra, ParcelaPedidoCompra, PedidoCompra
from apps.core.documentos import so_digitos
from apps.financeiro.models import CondicaoPagamento, ContaGerencial, ContaPagar, TipoPagamento
from apps.usuarios.models import Funcionario

FUSO = ZoneInfo("America/Sao_Paulo")
CONTA_COMPRAS = 58


def quando(valor) -> datetime | None:
    if not valor:
        return None
    return datetime.fromisoformat(str(valor).replace("Z", "+00:00")).astimezone(FUSO)


def dia(valor) -> date | None:
    if not valor:
        return None
    if len(str(valor)) == 10:
        return date.fromisoformat(valor)
    return quando(valor).date()


def d(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"))


def q(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.001"))


def t(valor, tamanho) -> str:
    return (str(valor).strip() if valor is not None else "")[:tamanho]


def endereco(prefixo: str, e: dict | None) -> dict:
    e = e or {}
    return {
        f"{prefixo}_cep": t(e.get("cep"), 9), f"{prefixo}_logradouro": t(e.get("l"), 150), f"{prefixo}_numero": t(e.get("nu"), 20),
        f"{prefixo}_complemento": t(e.get("c"), 150), f"{prefixo}_bairro": t(e.get("b"), 80), f"{prefixo}_cidade": t(e.get("ci"), 80),
        f"{prefixo}_uf": t(e.get("uf"), 2).upper(), f"{prefixo}_ibge": t(e.get("ib"), 7),
    }


class Command(BaseCommand):
    help = "Importa os pedidos de compra da MarketUP (ID = PurchaseOrderID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        fornecedores = set(Fornecedor.objects.values_list("id", flat=True))
        produtos = {p.id: p for p in Produto.objects.all()}
        unidades = set(Unidade.objects.values_list("id", flat=True))
        compradores = set(Funcionario.objects.values_list("id", flat=True))
        tipos = set(TipoPagamento.objects.values_list("id", flat=True))
        condicoes = set(CondicaoPagamento.objects.values_list("id", flat=True))
        contas = set(ContaGerencial.objects.values_list("id", flat=True))
        problemas, avisos = [], []
        for o in dados:
            if o["sup"] not in fornecedores:
                problemas.append(f"Pedido {o['id']}: fornecedor {o['sup']} não cadastrado.")
            for i in o["items"]:
                if i["it"] not in produtos:
                    problemas.append(f"Pedido {o['id']}: produto {i['it']} não cadastrado.")
                if i.get("un") and i["un"] not in unidades:
                    problemas.append(f"Pedido {o['id']}: unidade {i['un']} não cadastrada.")
            if d(o["sub"]) - d(o["gd"]) + d(o["shp"]) + d(o["tax"]) != d(o["tot"]):
                avisos.append(f"Pedido {o['id']}: subtotal − desconto + frete + outros ≠ total ({o['sub']} − {o['gd']} + {o['shp']} + {o['tax']} ≠ {o['tot']}).")
            for p in o["ins"]:
                if p.get("pt") not in (None, -1, 0) and p["pt"] not in tipos:
                    problemas.append(f"Pedido {o['id']}: forma de pagamento {p['pt']} não cadastrada.")
        if problemas:
            for p in problemas[:30]:
                self.stdout.write(self.style.ERROR(p))
            raise CommandError(f"{len(problemas)} problema(s): carregue antes os cadastros que faltam.")
        for a in avisos:
            self.stdout.write(self.style.WARNING(a))
        n_itens = sum(len(o["items"]) for o in dados)
        n_parcelas = sum(len(o["ins"]) for o in dados)
        self.stdout.write(f"Lidos {len(dados)} pedidos, {n_itens} itens e {n_parcelas} parcelas.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for o in dados:
                pedido_id = int(o["id"])
                ma = o.get("ma") if o.get("ma") in contas else CONTA_COMPRAS
                inv = o.get("inv") or [None, None, None, None]
                campos = {
                    "status": o["st"], "fornecedor_id": o["sup"], "comprador_id": o["buy"] if o.get("buy") in compradores else None,
                    "emissao": dia(o["iss"]), "previsao": dia(o.get("del")), "data_faturamento": quando(o.get("bil")),
                    "data_cancelamento": quando(o.get("can")), "observacao": o.get("obs") or "",
                    "subtotal": d(o["sub"]), "desconto": d(o["gd"]), "desconto_percentual": Decimal(str(o.get("gdp") or 0)).quantize(Decimal("0.0001")),
                    "desconto_em_percentual": False, "frete": d(o["shp"]), "outros_custos": d(o["tax"]), "total": d(o["tot"]),
                    "conta_gerencial_id": ma, "nota_numero": t(inv[1], 20), "nota_serie": t(inv[2], 5), "nota_emissao": dia(inv[3]),
                    "orcamento_id": o.get("bud") or None,
                    "sem_endereco_faturamento": not (o.get("bA") or {}).get("l"), "sem_endereco_entrega": not (o.get("dA") or {}).get("l"),
                    **endereco("fat", o.get("bA")), **endereco("ent", o.get("dA")),
                }
                pedido, _ = PedidoCompra.objects.update_or_create(id=pedido_id, defaults=campos)
                pedido.itens.all().delete()
                pedido.parcelas.all().delete()
                for i in o["items"]:
                    produto = produtos[i["it"]]
                    ItemPedidoCompra.objects.create(
                        id=i["id"], pedido=pedido, produto=produto, descricao=t(i.get("nm") or produto.descricao, 300),
                        unidade_id=i.get("un") or produto.unidade_id, quantidade=q(i["a"]), valor_unitario=d(i["v"]),
                        desconto=d(i.get("d")), desconto_percentual=Decimal(str(i.get("dp") or 0)).quantize(Decimal("0.0001")),
                        desconto_em_percentual=bool(i.get("adp")), subtotal=d(i.get("sub")), total=d(i.get("tot")),
                        recebido=q(i.get("r")), devolvido=q(i.get("rt")), data_devolucao=dia(i.get("rd")), valor_devolvido=d(i.get("rv")),
                        lote=t(i.get("b"), 40), validade=dia(i.get("ex")), observacao=t(i.get("o"), 500), ordem=i.get("ord") or 0,
                    )
                for p in o["ins"]:
                    ParcelaPedidoCompra.objects.create(
                        id=p["id"], pedido=pedido, numero=p.get("n") or 1, quantidade=p.get("c") or 1, vencimento=dia(p["dt"]),
                        valor=d(p["v"]), descricao=t(p.get("ds"), 300), grupo=t(p.get("g"), 40),
                        tipo_pagamento_id=p["pt"] if p.get("pt") in tipos else None,
                        condicao_pagamento_id=p["pc"] if p.get("pc") in condicoes else None,
                        conta_gerencial_id=p["ma"] if p.get("ma") in contas else CONTA_COMPRAS,
                        evento_marketup=p.get("ev") or None, saldo_marketup=d(p.get("bal")), pago_em_marketup=dia(p.get("lp")),
                    )
            # Contas a pagar já carregadas com o EventID: liga a parcela (origem 6, número = pedido).
            for parcela in ParcelaPedidoCompra.objects.exclude(evento_marketup=None):
                ContaPagar.objects.filter(pk=parcela.evento_marketup).update(
                    parcela_compra=parcela, origem=6, origem_id=parcela.pedido_id, fornecedor_id=parcela.pedido.fornecedor_id
                )
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [PedidoCompra, ItemPedidoCompra, ParcelaPedidoCompra]):
                    cursor.execute(sql)
        por_status = {s: PedidoCompra.objects.filter(status=s).count() for s in (1, 2, 6, 7)}
        self.stdout.write(self.style.SUCCESS(
            f"Gravados {len(dados)} pedidos ({por_status}), {ItemPedidoCompra.objects.count()} itens, "
            f"{ParcelaPedidoCompra.objects.count()} parcelas. Maior ID: {PedidoCompra.objects.order_by('-id').values_list('id', flat=True).first()}."
        ))
