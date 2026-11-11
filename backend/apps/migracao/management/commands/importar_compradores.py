"""Marca "Comprador?" nos funcionários que são compradores na MarketUP (M003 / T301).

Fonte: CompradoresMarketUP.json, lido em 10/11/2026 da lista de compradores da ficha do pedido de compra (`buyerList`,
só leitura): EmployeeID e nome. Os funcionários já existem (carga dos vendedores); este comando só liga o "Comprador?".

Uso: docker compose exec backend python manage.py importar_compradores /migracao/dados/CompradoresMarketUP.json
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.usuarios.models import Funcionario


class Command(BaseCommand):
    help = "Liga o \"Comprador?\" dos funcionários compradores da MarketUP (ID = EmployeeID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")

    def handle(self, arquivo, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        ids = [int(c["EmployeeID"]) for c in dados]
        faltam = set(ids) - set(Funcionario.objects.filter(pk__in=ids).values_list("id", flat=True))
        if faltam:
            raise CommandError(f"Funcionários não cadastrados: {sorted(faltam)}. Carregue os funcionários antes.")
        n = Funcionario.objects.filter(pk__in=ids).update(comprador=True)
        self.stdout.write(self.style.SUCCESS(f"{n} funcionários marcados como comprador: {ids}."))
