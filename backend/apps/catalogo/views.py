from django.db.models import ProtectedError
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet, PermissaoFuncionalidade

from .models import Categoria, Marca, Produto, Servico, Subcategoria, Unidade
from .serializers import (
    CategoriaSerializer,
    MarcaSerializer,
    ProdutoSerializer,
    ServicoSerializer,
    SubcategoriaSerializer,
    UnidadeSerializer,
)

FORMATOS_IMAGEM = {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}
EM_USO = "Está em uso no catálogo e não pode ser excluída."


class UnidadeViewSet(AuditoriaViewSet):
    funcionalidade = "unidades"
    funcionalidades_leitura = ["produtos", "servicos", "orcamentos", "pedidos"]
    queryset = Unidade.objects.all()
    serializer_class = UnidadeSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ["sigla", "nome"]

    def perform_update(self, serializer):
        if serializer.instance.sistema:
            raise ValidationError({"detail": "Unidade padrão do sistema: não pode ser alterada."})
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.sistema:
            raise ValidationError({"detail": "Unidade padrão do sistema: não pode ser excluída."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": EM_USO})


class MarcaViewSet(AuditoriaViewSet):
    funcionalidade = "marcas"
    funcionalidades_leitura = ["produtos"]
    queryset = Marca.objects.all()
    serializer_class = MarcaSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def perform_destroy(self, instance):
        try:
            instance.imagem.delete(save=False)
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": EM_USO})

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def imagem(self, request, pk=None):
        """"Enviar foto" / "Remover" da MarketUP: imagem da marca (campo "arquivo")."""
        marca = self.get_object()
        marca.imagem.delete(save=False)
        if request.method == "POST":
            arquivo = request.FILES.get("arquivo")
            if not arquivo or arquivo.content_type not in FORMATOS_IMAGEM:
                raise ValidationError({"arquivo": "Envie uma imagem PNG, JPG, SVG ou WEBP."})
            if arquivo.size > 2 * 1024 * 1024:
                raise ValidationError({"arquivo": "Imagem maior que 2 MB. Reduza o tamanho e envie de novo."})
            marca.imagem = arquivo
        marca.atualizado_por = request.user
        marca.save()
        return Response(MarcaSerializer(marca, context={"request": request}).data)


class CategoriaViewSet(AuditoriaViewSet):
    funcionalidade = "categorias"
    funcionalidades_leitura = ["produtos"]
    queryset = Categoria.objects.prefetch_related("subcategorias")
    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "subcategorias__nome"]
    ordering_fields = ["nome", "id"]

    def perform_destroy(self, instance):
        if instance.subcategorias.exists():
            raise ValidationError({"detail": "A categoria tem subcategorias. Remova-as antes de excluir."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": EM_USO})


class SubcategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista para os selects (ex.: ficha do produto); a gravação é pela categoria."""

    funcionalidade = "categorias"
    funcionalidades_leitura = ["produtos"]
    permission_classes = [PermissaoFuncionalidade]
    queryset = Subcategoria.objects.select_related("categoria")
    serializer_class = SubcategoriaSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        categoria = self.request.query_params.get("categoria")
        return queryset.filter(categoria_id=categoria) if categoria else queryset


class ProdutoViewSet(AuditoriaViewSet):
    funcionalidade = "produtos"
    funcionalidades_leitura = ["orcamentos", "pedidos", "listas_precos"]
    queryset = Produto.objects.select_related("unidade", "categoria", "subcategoria", "marca").prefetch_related(
        "composicao__item", "composicao__unidade"
    )
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descricao", "codigo_barras", "codigo_interno", "modelo", "marca__nome", "categoria__nome", "subcategoria__nome"]
    ordering_fields = ["descricao", "preco_venda", "id"]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if params.get("categoria"):
            queryset = queryset.filter(categoria_id=params["categoria"])
        if params.get("ativo") in ("true", "false"):
            queryset = queryset.filter(ativo=params["ativo"] == "true")
        if params.get("sem_ncm"):
            queryset = queryset.filter(ncm="")
        return queryset

    def perform_destroy(self, instance):
        try:
            instance.imagem.delete(save=False)
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O produto faz parte de um kit ou já foi usado. Desmarque Ativo para escondê-lo."})

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def imagem(self, request, pk=None):
        """Foto do produto (campo "arquivo"); DELETE remove."""
        produto = self.get_object()
        produto.imagem.delete(save=False)
        if request.method == "POST":
            arquivo = request.FILES.get("arquivo")
            if not arquivo or arquivo.content_type not in FORMATOS_IMAGEM:
                raise ValidationError({"arquivo": "Envie uma imagem PNG, JPG, SVG ou WEBP."})
            if arquivo.size > 2 * 1024 * 1024:
                raise ValidationError({"arquivo": "Imagem maior que 2 MB. Reduza o tamanho e envie de novo."})
            produto.imagem = arquivo
        produto.atualizado_por = request.user
        produto.save()
        return Response(ProdutoSerializer(produto, context={"request": request}).data)


class ServicoViewSet(AuditoriaViewSet):
    funcionalidade = "servicos"
    funcionalidades_leitura = ["orcamentos", "pedidos", "listas_precos"]
    queryset = Servico.objects.select_related("unidade")
    serializer_class = ServicoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "codigo_barras"]
    ordering_fields = ["nome", "preco_venda", "id"]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O serviço já foi usado. Desmarque Ativo para escondê-lo."})
