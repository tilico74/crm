from django.db import migrations


def criar(apps, schema_editor):
    """Tipos e local com os IDs da MarketUP (estoque nunca usado lá: só o padrão existe)."""
    Tipo = apps.get_model("estoque", "TipoEstocagem")
    Local = apps.get_model("estoque", "LocalEstoque")
    Tipo.objects.update_or_create(id=1, defaults={"nome": "Padrão", "sistema": True})
    Tipo.objects.update_or_create(id=2, defaults={"nome": "Refrigerado"})
    Local.objects.update_or_create(id=1, defaults={"nome": "Estoque Padrão", "tipo_id": 1, "padrao": True, "sistema": True, "ativo": True})
    from django.core.management.color import no_style
    from django.db import connection

    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), [Tipo, Local]):
            cursor.execute(sql)


class Migration(migrations.Migration):
    dependencies = [("estoque", "0001_initial")]

    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
