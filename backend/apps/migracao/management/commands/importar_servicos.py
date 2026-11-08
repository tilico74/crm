"""Carga dos serviços da MarketUP (M003), com o ServiceID como ID.

Fonte: ServicosMarketUP.json (dados da listagem Catálogo › Serviços da MarketUP).
Uso: docker compose exec backend python manage.py importar_servicos /migracao/dados/ServicosMarketUP.json [--simular]
"""

import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.catalogo.models import Servico, Unidade


class Command(BaseCommand):
    help = "Importa os serviços da MarketUP (ID = ServiceID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        unidades = set(Unidade.objects.values_list("id", flat=True))
        servicos = []
        for s in dados:
            unidade = s.get("ItemUnitID") or 1
            if unidade not in unidades:
                raise CommandError(f"Serviço {s['ServiceID']}: unidade {unidade} não existe. Rode importar_produtos antes.")
            servicos.append({
                "id": s["ServiceID"], "ativo": bool(s.get("Active", True)), "codigo_barras": (s.get("Barcode") or "")[:20],
                "nome": s["Name"].strip()[:200], "preco_custo": Decimal(str(s.get("Cost") or 0)),
                "preco_venda": Decimal(str(s.get("Value") or 0)), "unidade_id": unidade,
            })
        self.stdout.write(f"Lidos {len(servicos)} serviços.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for s in servicos:
                Servico.objects.update_or_create(id=s.pop("id"), defaults=s)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [Servico]):
                    cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS(f"Gravados {len(servicos)} serviços. Total no banco: {Servico.objects.count()}."))
