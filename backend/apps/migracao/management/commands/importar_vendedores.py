"""Carga dos vendedores da MarketUP (M003), com o EmployeeID como ID.

Fonte: VendedoresMarketUP.json, lido da lista do campo "Vendedor" do pedido da MarketUP
(`controller.sellerList`: EmployeeID e OfficialName). Os demais dados do funcionário vêm com a base completa (M002).
Uma recarga não apaga o que já foi completado na ficha do funcionário: só garante nome e "Vendedor?".
Uso: docker compose exec backend python manage.py importar_vendedores /migracao/dados/VendedoresMarketUP.json [--simular]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.usuarios.models import Funcionario


class Command(BaseCommand):
    help = "Importa os vendedores da MarketUP como funcionários (ID = EmployeeID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        vendedores = [{"id": int(v["EmployeeID"]), "nome": v["OfficialName"].strip()[:150]} for v in dados]
        self.stdout.write(f"Lidos {len(vendedores)} vendedores.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for v in vendedores:
                funcionario = Funcionario.objects.filter(pk=v["id"]).first() or Funcionario(id=v["id"])
                funcionario.nome = v["nome"]
                funcionario.vendedor = True
                funcionario.save()
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [Funcionario]):
                    cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS(f"Gravados {len(vendedores)} vendedores. Funcionários no banco: {Funcionario.objects.count()}."))
