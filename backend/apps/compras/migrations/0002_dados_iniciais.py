from django.db import migrations

# Tipos de fornecedor da MarketUP da RDX (supplier_type, lido em 09/11/2026).
TIPOS = [(1, "Geral"), (2, "Matéria Prima"), (3, "Material de Escritório"), (4, "Serviços"), (5, "Entregas")]

# Funcionalidades da tela Permissões da MarketUP: Pessoas › Fornecedores e Tipos de fornecedor;
# Compras › Orçamento de compra, Pedido de compra e Devoluções ("Central de compras" fica fora).
FUNCIONALIDADES = [
    ("Pessoas", [("fornecedores", "Fornecedores"), ("tipos_fornecedor", "Tipos de fornecedor")]),
    ("Compras", [
        ("orcamentos_compra", "Orçamento de compra"), ("pedidos_compra", "Pedido de compra"),
        ("devolucoes_compra", "Devoluções de compra"),
    ]),
]


def criar(apps, schema_editor):
    Tipo = apps.get_model("compras", "TipoFornecedor")
    for pk, nome in TIPOS:
        Tipo.objects.update_or_create(id=pk, defaults={"nome": nome})
    from django.core.management.color import no_style
    from django.db import connection

    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), [Tipo]):
            cursor.execute(sql)

    # Como na T101: só o Administrador nasce com acesso; os demais grupos são configurados na tela Permissões.
    Funcionalidade = apps.get_model("usuarios", "Funcionalidade")
    Grupo = apps.get_model("usuarios", "Grupo")
    PermissaoGrupo = apps.get_model("usuarios", "PermissaoGrupo")
    ordem = (Funcionalidade.objects.order_by("-ordem").values_list("ordem", flat=True).first() or 0)
    admin = Grupo.objects.filter(nome="Administrador").first()
    for modulo, itens in FUNCIONALIDADES:
        for codigo, nome in itens:
            ordem += 10
            f, _ = Funcionalidade.objects.update_or_create(codigo=codigo, defaults={"modulo": modulo, "nome": nome, "ordem": ordem})
            if admin:
                PermissaoGrupo.objects.update_or_create(
                    grupo=admin, funcionalidade=f, defaults={"acessar": True, "adicionar": True, "alterar": True, "excluir": True}
                )


class Migration(migrations.Migration):
    dependencies = [("compras", "0001_initial"), ("usuarios", "0003_grupos_e_funcionalidades")]

    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
