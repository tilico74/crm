"""Lista de preços "Padrão" e tipos de documento da MarketUP, com os mesmos IDs.

Os clientes e as outras listas vêm da migração (exportação "Código Sistema" = ClientID).
"""

from django.core.management.color import no_style
from django.db import migrations

LISTAS = [(1, "Padrão")]
TIPOS_DOCUMENTO = [
    (6, "Inscrição Estadual"),
    (11, "Inscrição Municipal"),
    (12, "Inscrição Estadual ST"),
    (13, "CNAE"),
    (14, "Suframa"),
]


def criar(apps, schema_editor):
    ListaPreco = apps.get_model("clientes", "ListaPreco")
    TipoDocumento = apps.get_model("clientes", "TipoDocumento")
    for id_, nome in LISTAS:
        ListaPreco.objects.update_or_create(id=id_, defaults={"nome": nome})
    for id_, nome in TIPOS_DOCUMENTO:
        TipoDocumento.objects.update_or_create(id=id_, defaults={"nome": nome})
    # IDs gravados à mão: a sequência vai para MAX(id) + 1 (regras-de-negocio/ids-marketup.md).
    with schema_editor.connection.cursor() as cursor:
        for sql in schema_editor.connection.ops.sequence_reset_sql(no_style(), [ListaPreco, TipoDocumento]):
            cursor.execute(sql)


class Migration(migrations.Migration):
    dependencies = [("clientes", "0001_initial")]

    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
