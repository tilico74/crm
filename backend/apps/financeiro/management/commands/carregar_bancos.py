"""
Carrega (ou atualiza) a lista oficial de bancos do Banco Central, via BrasilAPI.

Uso: docker compose exec backend python manage.py carregar_bancos
A chave é o código de compensação com 3 dígitos ("001"), o mesmo da MarketUP;
contas correntes migradas ligam ao banco por esse código.
"""

from django.core.management.base import BaseCommand

from apps.core.localidades import buscar_json
from apps.financeiro.models import Banco

URL = "https://brasilapi.com.br/api/banks/v1"


class Command(BaseCommand):
    help = "Carrega a lista oficial de bancos (Banco Central, via BrasilAPI)."

    def handle(self, *args, **options):
        criados = atualizados = 0
        for item in buscar_json(URL):
            if item.get("code") is None:  # sistemas do BC sem código de compensação (ex.: Selic)
                continue
            codigo = str(item["code"]).zfill(3)
            nome = (item.get("fullName") or item.get("name") or "").strip()
            _, novo = Banco.objects.update_or_create(codigo=codigo, defaults={"nome": nome})
            criados += novo
            atualizados += not novo
        self.stdout.write(self.style.SUCCESS(f"Bancos: {criados} novos, {atualizados} atualizados."))
