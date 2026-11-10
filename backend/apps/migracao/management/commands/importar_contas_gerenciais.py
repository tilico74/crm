"""Carga do plano de contas (contas gerenciais) da MarketUP (M003), com o ManagementAccountID como ID.

Fonte: ContasGerenciaisMarketUP.json, lido da tela Ajustes › Financeiro › Conta gerencial da MarketUP (58 contas).
Colunas: id, nome, DreAccountID, IsCredit, IsPreDefined, Active, AllowPurchase.
Uso: docker compose exec backend python manage.py importar_contas_gerenciais /migracao/dados/ContasGerenciaisMarketUP.json [--simular]
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.financeiro.models import ContaGerencial

# DreAccountID da MarketUP → classificação DRE do RDX.
DRE = {
    1: "entradas", 2: "impostos_devolucoes", 3: "custo_mercadoria", 5: "gerais_administrativas", 6: "aluguel",
    7: "propaganda_marketing", 8: "pessoal", 9: "pro_labore", 10: "utilidades", 11: "receitas_financeiras", 12: "despesas_financeiras",
}


class Command(BaseCommand):
    help = "Importa as contas gerenciais da MarketUP (ID = ManagementAccountID)."

    def add_arguments(self, parser):
        parser.add_argument("arquivo")
        parser.add_argument("--simular", action="store_true")

    def handle(self, arquivo, simular, **opcoes):
        if not Path(arquivo).exists():
            raise CommandError(f"Arquivo não encontrado: {arquivo}")
        dados = json.loads(Path(arquivo).read_text(encoding="utf-8"))
        contas = []
        for id_, nome, dre, credito, sistema, ativo, compras in dados["contas"]:
            if dre is not None and dre not in DRE:
                raise CommandError(f"Conta {id_}: grupo do DRE {dre} sem correspondência.")
            contas.append({
                "id": id_, "nome": nome, "tipo": ContaGerencial.Tipo.ENTRADA if credito else ContaGerencial.Tipo.SAIDA,
                "classificacao_dre": DRE.get(dre, ""), "sistema": bool(sistema), "ativo": bool(ativo), "compras": bool(compras),
            })
        self.stdout.write(f"Lidas {len(contas)} contas gerenciais.")
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return
        with transaction.atomic():
            for c in contas:
                ContaGerencial.objects.update_or_create(id=c.pop("id"), defaults=c)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [ContaGerencial]):
                    cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS(f"Gravadas {len(contas)} contas. Total no banco: {ContaGerencial.objects.count()}."))
