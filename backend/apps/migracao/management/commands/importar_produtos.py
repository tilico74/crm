"""Carga do catálogo de produtos da MarketUP (M003), com os IDs da MarketUP.

Fontes (pasta migracao/dados, montada em /migracao/dados):
- ProdutosMarketUP.json: dados da listagem Catálogo › Produtos da MarketUP (tem o ItemID, a categoria
  e a subcategoria com IDs, os preços). Gerado pela tela, com "Ver mais registros" até o fim.
- Produtos.xlsx: exportação da mesma listagem (tem a unidade, o tipo de produto e os dados fiscais).
As duas casam pelo código de barras.

Uso:
    docker compose exec backend python manage.py importar_produtos \
        /migracao/dados/ProdutosMarketUP.json /migracao/dados/Produtos.xlsx [--simular]

Unidades com os IDs da tela Unidades de Medida da MarketUP (conferido em 08/11/2026).
A composição dos kits não vem nessas fontes: os kits entram como tipo Kit, sem itens (M002).
"""

import json
from decimal import Decimal
from pathlib import Path

import openpyxl
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from apps.catalogo.models import Categoria, Produto, Subcategoria, Unidade

# ID MarketUP, sigla, nome (Catálogo › Unidades de Medida). 1 a 5 já existem como unidades do sistema.
UNIDADES = [
    (1, "UN", "Unidade"), (2, "CX", "Caixa"), (3, "FD", "Fardo"), (4, "KG", "Quilograma"), (5, "HF", "Hora/Funcionário"),
    (6, "M²", "M²"), (7, "M", "Metro"), (8, "ML", "Milheiro"), (9, "CT", "Cento"), (10, "BR", "Barra"),
]
# Nome da unidade na exportação → ID.
UNIDADE_POR_NOME = {"unidade": 1, "caixa": 2, "fardo": 3, "quilograma": 4, "hora/funcionário": 5, "m²": 6, "metro": 7, "milheiro": 8, "cento": 9, "barra": 10}
TIPOS_ITEM = {"produto": "produto", "kit": "kit", "insumo": "insumo", "brinde": "brinde"}
TIPOS_FISCAIS = {
    "mercadoria para revenda": "revenda", "matéria-prima": "materia_prima", "embalagem": "embalagem",
    "produto em processo": "em_processo", "produto acabado": "acabado", "subproduto": "subproduto",
    "produto intermediário": "intermediario", "material de uso e consumo": "uso_consumo",
    "ativo imobilizado": "ativo_imobilizado", "serviços": "servicos", "outros insumos": "outros_insumos", "outras": "outras",
}
ORIGENS = {"NACIONAL": 0, "ESTRANG-IMPORTACAO DIRETA": 1, "ESTRANG-ADQUIRIDA NO MERC.INT.": 2}


def texto(v) -> str:
    return "" if v is None else str(v).strip()


def dinheiro(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal("0.01"))


def digitos(v) -> str:
    return "".join(c for c in texto(v) if c.isdigit())


class Command(BaseCommand):
    help = "Importa unidades, categorias e produtos da MarketUP (ID = ItemID)."

    def add_arguments(self, parser):
        parser.add_argument("json")
        parser.add_argument("xlsx")
        parser.add_argument("--simular", action="store_true")

    def handle(self, json, xlsx, simular, **opcoes):
        for caminho in (json, xlsx):
            if not Path(caminho).exists():
                raise CommandError(f"Arquivo não encontrado: {caminho}")
        lista = __import__("json").loads(Path(json).read_text(encoding="utf-8"))
        planilha = list(openpyxl.load_workbook(xlsx, read_only=True, data_only=True).active.iter_rows(values_only=True))
        cab = [texto(c) for c in planilha[0]]
        col = {nome: cab.index(nome) for nome in ("Código de Barras", "Tipo de Produto", "Unidade", "Tipo", "NCM", "Origem", "CEST", "Tags", "Código Balança", "Movimenta Estoque")}
        exportacao = {texto(r[col["Código de Barras"]]): r for r in planilha[1:] if r[col["Código de Barras"]]}

        avisos = []
        categorias, subcategorias, produtos = {}, {}, []
        for p in lista:
            linha = exportacao.get(texto(p["BarCode"]))
            if linha is None:
                avisos.append(f"Item {p['ItemID']}: código de barras sem linha na exportação (unidade = UN).")
            v = (lambda nome: linha[col[nome]]) if linha else (lambda nome: None)  # noqa: E731
            if p.get("CategoryID"):
                categorias[p["CategoryID"]] = p.get("CategoryName") or f"Categoria {p['CategoryID']}"
            if p.get("SubcategoryID"):
                subcategorias[p["SubcategoryID"]] = (p.get("SubcategoryName") or f"Subcategoria {p['SubcategoryID']}", p.get("CategoryID"))
            unidade = UNIDADE_POR_NOME.get(texto(v("Unidade")).lower(), 1)
            if texto(v("Unidade")) and texto(v("Unidade")).lower() not in UNIDADE_POR_NOME:
                avisos.append(f"Item {p['ItemID']}: unidade '{v('Unidade')}' desconhecida; usada UN.")
            ncm = digitos(v("NCM") or p.get("NcmName"))
            produtos.append(Produto(
                id=p["ItemID"],
                ativo=bool(p.get("IsActive", True)),
                codigo_barras=texto(p["BarCode"])[:20],
                descricao=texto(p["Name"])[:200],
                tipo_item=TIPOS_ITEM.get(texto(v("Tipo de Produto")).lower(), "kit" if p.get("IsKit") else "produto"),
                unidade_id=unidade,
                codigo_balanca=texto(v("Código Balança") or p.get("BalanceCode"))[:20],
                categoria_id=p.get("CategoryID") or None,
                subcategoria_id=p.get("SubcategoryID") or None,
                modelo=texto(p.get("Model"))[:80],
                codigo_interno=texto(p.get("InternalCode"))[:40],
                tags=[t.strip() for t in texto(v("Tags") or p.get("Tags")).split(",") if t.strip()],
                preco_custo=dinheiro(p.get("Cost")),
                preco_venda=dinheiro(p.get("SaleValue")),
                preco_atacado=dinheiro(p.get("WholesaleValue")),
                quantidade_minima_atacado=Decimal(str(p.get("WholesaleAmount") or 0)),
                movimenta_estoque=bool(p.get("MovesStock")) or texto(v("Movimenta Estoque")) == "Sim",
                movimenta_estoque_composicao=bool(p.get("InMoveStockComposite")),
                tipo_fiscal=TIPOS_FISCAIS.get(texto(v("Tipo")).lower(), ""),
                ncm=ncm if len(ncm) == 8 else "",
                origem=ORIGENS.get(texto(v("Origem")).upper()),
                cest=digitos(v("CEST"))[:7],
            ))
            if p.get("InFragmentation"):
                avisos.append(f"Item {p['ItemID']}: tem fragmentação na MarketUP; conferir na ficha (não vem na listagem completa).")

        sem_ncm = sum(1 for x in produtos if not x.ncm)
        kits = sum(1 for x in produtos if x.tipo_item == "kit")
        self.stdout.write(f"Lidos {len(produtos)} produtos ({kits} kits, {sum(not x.ativo for x in produtos)} inativos, {sem_ncm} sem NCM), "
                          f"{len(categorias)} categorias, {len(subcategorias)} subcategorias.")
        for aviso in avisos:
            self.stdout.write(self.style.WARNING(f"  {aviso}"))
        if kits:
            self.stdout.write(self.style.WARNING(f"  {kits} kits entram sem a composição (não vem nas fontes; depende da M002)."))
        if simular:
            self.stdout.write(self.style.WARNING("Simulação: nada foi gravado."))
            return

        with transaction.atomic():
            for id_, sigla, nome in UNIDADES:
                Unidade.objects.update_or_create(id=id_, defaults={"sigla": sigla, "nome": nome, "sistema": id_ <= 5})
            for id_, nome in categorias.items():
                Categoria.objects.update_or_create(id=id_, defaults={"nome": nome})
            for id_, (nome, categoria) in subcategorias.items():
                Subcategoria.objects.update_or_create(id=id_, defaults={"nome": nome, "categoria_id": categoria})
            existentes = set(Produto.objects.filter(id__in=[p.id for p in produtos]).values_list("id", flat=True))
            Produto.objects.bulk_create([p for p in produtos if p.id not in existentes], batch_size=200)
            campos = [f.name for f in Produto._meta.concrete_fields if f.name not in ("id", "imagem", "criado_em", "criado_por", "atualizado_por", "fragmentacao_quantidade", "fragmentacao_unidade", "fragmentacao_preco", "reajustar_pela_margem", "classificacao")]
            atualizar = [p for p in produtos if p.id in existentes]
            from django.utils import timezone

            for p in atualizar:
                p.atualizado_em = timezone.now()
            if atualizar:
                Produto.objects.bulk_update(atualizar, campos, batch_size=200)
            with connection.cursor() as cursor:
                for sql in connection.ops.sequence_reset_sql(no_style(), [Unidade, Categoria, Subcategoria, Produto]):
                    cursor.execute(sql)

        ids = {p.id for p in produtos}
        no_banco = set(Produto.objects.filter(id__in=ids).values_list("id", flat=True))
        with connection.cursor() as cursor:
            cursor.execute("SELECT last_value FROM produto_id_seq")
            seq = cursor.fetchone()[0]
        ok = no_banco == ids and seq >= max(ids)
        self.stdout.write(self.style.SUCCESS(
            f"Gravados: {len(produtos) - len(atualizar)} novos, {len(atualizar)} atualizados. "
            f"Conferência: {len(ids)} na fonte, {len(no_banco)} no banco, maior ID {max(ids)}, próximo ID {seq + 1} → {'OK' if ok else 'DIVERGÊNCIA'}"
        ))
        if not ok:
            raise CommandError("Conferência com divergência.")
