"""Carga das contas correntes da MarketUP (M003), com o AccountID como ID.

Fonte: ContasCorrentesMarketUP.json, lido da tela Ajustes › Financeiro › Contas correntes da MarketUP
(AccountID, nome, interna, principal, ativo, banco pelo código, agência e conta). Banco casado pelo código (ex.: 260).
Uso: docker compose exec backend python manage.py importar_contas_correntes /migracao/dados/ContasCorrentesMarketUP.json [--simular]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.financeiro.models import Banco, ContaCorrente


class Command(BaseCommand):
    help = "Importa as contas correntes da MarketUP (ID = AccountID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        bancos = dict(Banco.objects.values_list("codigo", "id"))
        contas = []
        for c in dados:
            codigo = (c.get("BankCode") or "").strip()
            if codigo and codigo not in bancos:
                raise CommandError(f"Conta {c['AccountID']}: banco {codigo} não cadastrado.")
            contas.append({
                "id": int(c["AccountID"]), "nome": c["Name"].strip()[:120], "interna": bool(c.get("IsInternal")),
                "principal": bool(c.get("IsDefault")), "ativo": bool(c.get("Active", True)), "banco_id": bancos.get(codigo),
                "agencia": c.get("Agency") or "", "agencia_digito": c.get("AgencyDigit") or "",
                "conta": c.get("Account") or "", "conta_digito": c.get("AccountDigit") or "",
            })
        self.stdout.write(f"Lidas {len(contas)} contas correntes.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for c in contas:
                ContaCorrente.objects.update_or_create(id=c.pop("id"), defaults=c)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [ContaCorrente]):
                    cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS(f"Gravadas {len(contas)} contas. Total no banco: {ContaCorrente.objects.count()}."))
