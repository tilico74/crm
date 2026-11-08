from django.db import models

from apps.core.models import ModeloBase

# Catálogo › tabelas auxiliares, com os IDs da MarketUP (UnitID, BrandID, CategoryID,
# SubcategoryID). Campos e telas: context/marketup/telas-e-entidades.md (Catálogo).


class Unidade(ModeloBase):
    sigla = models.CharField("sigla", max_length=10, unique=True)
    nome = models.CharField("nome", max_length=60)
    # Unidades padrão da MarketUP (UN, CX, FD, KG, HF): não editam nem excluem.
    sistema = models.BooleanField("do sistema", default=False)

    class Meta:
        db_table = "unidade"
        ordering = ["nome"]
        verbose_name = "unidade de medida"
        verbose_name_plural = "unidades de medida"

    def __str__(self):
        return f"{self.sigla} - {self.nome}"


class Marca(ModeloBase):
    nome = models.CharField("nome", max_length=80)
    imagem = models.FileField("imagem", upload_to="marcas/", blank=True)

    class Meta:
        db_table = "marca"
        ordering = ["nome"]
        verbose_name = "marca"
        verbose_name_plural = "marcas"

    def __str__(self):
        return self.nome


class Categoria(ModeloBase):
    nome = models.CharField("nome", max_length=80)

    class Meta:
        db_table = "categoria"
        ordering = ["nome"]
        verbose_name = "categoria"
        verbose_name_plural = "categorias"

    def __str__(self):
        return self.nome


class Subcategoria(ModeloBase):
    categoria = models.ForeignKey(Categoria, verbose_name="categoria", on_delete=models.PROTECT, related_name="subcategorias")
    nome = models.CharField("nome", max_length=80)

    class Meta:
        db_table = "subcategoria"
        ordering = ["nome"]
        verbose_name = "subcategoria"
        verbose_name_plural = "subcategorias"

    def __str__(self):
        return f"{self.categoria} › {self.nome}"
