"""Carga dos tipos de pagamento e das condições (parcelamentos) da MarketUP, com os IDs da MarketUP.

Fonte: PagamentosMarketUP.json (lista que a ficha do orçamento da MarketUP carrega para
"Forma de pagamento" / "Parcelamento": PaymentTypeID e PaymentConditionID).

Uso: docker compose exec backend python manage.py importar_pagamentos /migracao/dados/PagamentosMarketUP.json [--simular]
Recarregar atualiza pelos mesmos IDs.
"""

import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.financeiro.models import CondicaoPagamento, TipoPagamento


def pct(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))


class Command(BaseCommand):
    help = "Importa tipos de pagamento e condições da MarketUP (ID = PaymentTypeID / PaymentConditionID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        tipos = json.loads(Path(arquivo).read_text(encoding="utf-8"))["tipos"]
        condicoes = [(t["id"], c) for t in tipos for c in t["cond"]]
        ids = [c[0] for _, c in condicoes]
        if len(ids) != len(set(ids)):
            raise CommandError("Há PaymentConditionID repetido no arquivo.")
        self.stdout.write(f"Lidos {len(tipos)} tipos de pagamento e {len(condicoes)} condições.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return

        with transaction.atomic():
            for t in tipos:
                TipoPagamento.objects.update_or_create(
                    id=t["id"], defaults={"descricao": t["nome"].strip(), "ativo": bool(t["ativo"]), "carencia": int(t.get("car") or 0)}
                )
            for tipo_id, (cid, nome, parcelas, intervalo, primeira, adm, antecipacao, fixo, compras, vendas) in condicoes:
                CondicaoPagamento.objects.update_or_create(
                    id=cid,
                    defaults={
                        "tipo_id": tipo_id, "descricao": nome.strip(), "parcelas": max(1, int(parcelas)),
                        "intervalo": int(intervalo), "primeira_parcela": int(primeira),
                        "percentual_adm": pct(adm), "percentual_antecipacao": pct(antecipacao), "valor_fixo": pct(fixo),
                        "compras": bool(compras), "vendas": bool(vendas),
                    },
                )
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [TipoPagamento, CondicaoPagamento]):
                    cursor.execute(sql)

        self.stdout.write(self.style.SUCCESS(
            f"Gravados: {TipoPagamento.objects.filter(id__in=[t['id'] for t in tipos]).count()} tipos, "
            f"{CondicaoPagamento.objects.filter(id__in=ids).count()} condições."
        ))
