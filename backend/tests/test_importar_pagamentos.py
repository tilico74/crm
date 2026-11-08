import json

import pytest
from django.core.management import call_command

from apps.financeiro.models import CondicaoPagamento, TipoPagamento
from apps.vendas.calculo import gerar_parcelas

pytestmark = pytest.mark.django_db

DADOS = {"tipos": [
    {"id": 3, "nome": "CARTÃO DE CRÉDITO", "ativo": True, "car": 0, "cond": [
        [11, "ENTRADA + 01x COM JUROS", 2, 30, 0, 0, 0, 0, 1, 1],
        [24, "SEM ENTRADA + 03x SEM JUROS", 3, 30, 30, 0, 0, 0, 1, 1]]},
    {"id": 4, "nome": "CHEQUE", "ativo": True, "car": 0, "cond": [[31, "02x (30 e 90 Dias)", 2, 60, 30, 0, 0, 0, 1, 1]]},
]}


def test_importa_com_ids_e_parcelas_batem_com_os_nomes(tmp_path):
    arquivo = tmp_path / "p.json"
    arquivo.write_text(json.dumps(DADOS), encoding="utf-8")
    call_command("importar_pagamentos", str(arquivo))
    call_command("importar_pagamentos", str(arquivo))  # recarga não duplica
    assert TipoPagamento.objects.get(pk=3).descricao == "CARTÃO DE CRÉDITO" and CondicaoPagamento.objects.count() == 3
    from datetime import date

    def dias(cid):
        c = CondicaoPagamento.objects.get(pk=cid)
        return [(p.vencimento - date(2026, 1, 1)).days for p in gerar_parcelas(300, c.parcelas, date(2026, 1, 1), c.primeira_parcela, c.intervalo)]

    assert dias(11) == [0, 30]          # entrada + 1x
    assert dias(24) == [30, 60, 90]     # sem entrada, 3x
    assert dias(31) == [30, 90]         # 30 e 90 dias
