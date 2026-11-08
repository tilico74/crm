"""Unidades padrão da MarketUP, com os mesmos IDs (não editam nem excluem).

As outras unidades, marcas e categorias vêm da migração da MarketUP (M003).
"""

from django.core.management.color import no_style
from django.db import migrations

UNIDADES = [(1, "UN", "Unidade"), (2, "CX", "Caixa"), (3, "FD", "Fardo"), (4, "KG", "Quilograma"), (5, "HF", "Hora/Funcionário")]


def criar(apps, schema_editor):
    Unidade = apps.get_model("catalogo", "Unidade")
    for id_, sigla, nome in UNIDADES:
        Unidade.objects.update_or_create(id=id_, defaults={"sigla": sigla, "nome": nome, "sistema": True})
    # IDs gravados à mão: a sequência do banco vai para MAX(id) + 1 (regras-de-negocio/ids-marketup.md).
    with schema_editor.connection.cursor() as cursor:
        for sql in schema_editor.connection.ops.sequence_reset_sql(no_style(), [Unidade]):
            cursor.execute(sql)


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0001_initial")]

    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
