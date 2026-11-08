"""Funcionalidades da matriz de permissões e grupos da RDX (decisões da T101).

Funcionalidades: as da tela Permissões da MarketUP que estão no escopo
(sem PDV, loja virtual, restaurantes). Grupos: os da MarketUP sem "Operador PDV",
mais "Técnico". Só o Administrador nasce com acesso; os demais grupos são
configurados na tela Permissões.
"""

from django.db import migrations

FUNCIONALIDADES = [
    ("Catálogo", [
        ("produtos", "Produtos"), ("servicos", "Serviços"), ("categorias", "Categorias"),
        ("marcas", "Marcas"), ("unidades", "Unidades de medida"),
    ]),
    ("Vendas", [
        ("orcamentos", "Orçamento de venda"), ("pedidos", "Pedido de venda"), ("crm", "CRM"),
        ("comissoes_lancamento", "Lançamento de comissões"), ("comissoes_aprovacao", "Aprovação de comissões"),
    ]),
    ("Pessoas", [
        ("clientes", "Clientes"), ("listas_precos", "Lista de preços / Tipos de cliente"),
    ]),
    ("Financeiro", [
        ("contas_pagar", "Pagamentos"), ("contas_receber", "Recebimentos"),
        ("movimentacao_caixa", "Movimentação de caixa"), ("fluxo_caixa", "Fluxo de caixa"),
        ("contas_correntes", "Contas correntes"), ("contas_gerenciais", "Contas gerenciais"),
        ("tipos_pagamento", "Tipo de pagamento"),
    ]),
    ("Estoque", [
        ("consulta_estoque", "Consulta de estoque"), ("movimentacoes_estoque", "Movimentações de estoque"),
        ("locais_estoque", "Locais de estoque"), ("tipos_estocagem", "Tipos de estocagem"),
        ("motivos_movimentacao", "Motivo"),
    ]),
    ("Faturamento", [
        ("notas_fiscais", "Nota fiscal"), ("naturezas_operacao", "Natureza de operação"),
        ("matriz_fiscal", "Matriz fiscal"),
    ]),
    ("Ordem de serviço", [("ordens_servico", "Ordem de serviço")]),
    ("Relatórios", [("relatorios", "Relatórios")]),
    ("Ajustes", [
        ("empresa", "Informações da empresa"), ("funcionarios", "Funcionários"),
        ("parametros_venda", "Parâmetros de venda"), ("permissoes", "Permissões"),
    ]),
]

GRUPOS = [
    "Administrador", "Administrativo", "Auxiliar Administrativo", "Comprador", "Gerente",
    "Gerente + Administrativo", "Vendedor", "Vendedor Redex", "Técnico",
]


def criar(apps, schema_editor):
    Funcionalidade = apps.get_model("usuarios", "Funcionalidade")
    Grupo = apps.get_model("usuarios", "Grupo")
    PermissaoGrupo = apps.get_model("usuarios", "PermissaoGrupo")

    ordem = 0
    for modulo, itens in FUNCIONALIDADES:
        for codigo, nome in itens:
            ordem += 10
            Funcionalidade.objects.update_or_create(codigo=codigo, defaults={"modulo": modulo, "nome": nome, "ordem": ordem})

    for nome in GRUPOS:
        Grupo.objects.get_or_create(nome=nome)

    admin = Grupo.objects.get(nome="Administrador")
    for funcionalidade in Funcionalidade.objects.all():
        PermissaoGrupo.objects.update_or_create(
            grupo=admin,
            funcionalidade=funcionalidade,
            defaults={"acessar": True, "adicionar": True, "alterar": True, "excluir": True},
        )


class Migration(migrations.Migration):
    dependencies = [("usuarios", "0002_funcionalidade_funcionario_grupo_usuario_grupo_and_more")]

    operations = [migrations.RunPython(criar, migrations.RunPython.noop)]
