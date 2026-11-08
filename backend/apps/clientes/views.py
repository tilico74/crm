from django.db.models import ProtectedError
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet
from apps.core.documentos import limpar_cnpj, so_digitos

from .models import Cliente, ListaPreco, TipoDocumento
from .serializers import (
    ClienteListaSerializer,
    ClienteSerializer,
    DocumentoClienteSerializer,
    ListaPrecoSerializer,
    TipoDocumentoSerializer,
)

FORMATOS_ANEXO = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


class ListaPrecoViewSet(AuditoriaViewSet):
    """Vendas › Lista de preços / Tipos de clientes (client_type)."""

    funcionalidade = "listas_precos"
    funcionalidades_leitura = ["clientes", "orcamentos"]
    queryset = ListaPreco.objects.prefetch_related("itens__produto", "itens__servico")
    serializer_class = ListaPrecoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def perform_destroy(self, instance):
        if instance.id == 1:
            raise ValidationError({"detail": "A lista Padrão é a do sistema e não pode ser excluída."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Há clientes nesta lista. Troque o tipo deles antes de excluir."})


class TipoDocumentoViewSet(AuditoriaViewSet):
    """Tipos da aba Documentos; o "+" da ficha do cliente cadastra um novo."""

    funcionalidade = "clientes"
    queryset = TipoDocumento.objects.all()
    serializer_class = TipoDocumentoSerializer
    pagination_class = None

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Há documentos de clientes com este tipo."})


class ClienteViewSet(AuditoriaViewSet):
    funcionalidade = "clientes"
    funcionalidades_leitura = ["orcamentos"]
    queryset = Cliente.objects.select_related("lista_preco")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "apelido", "cpf", "cnpj", "telefone", "celular", "email"]
    ordering_fields = ["nome", "id"]

    def get_serializer_class(self):
        return ClienteListaSerializer if self.action == "list" else ClienteSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            queryset = queryset.prefetch_related("enderecos", "contatos", "dados_bancarios__banco", "documentos__tipo", "historico")
        # Filtros da MarketUP: Bloqueado, CPF, CNPJ, Tipo, Telefone, E-mail.
        p = self.request.query_params
        if p.get("bloqueado") in ("true", "false"):
            queryset = queryset.filter(bloqueado=p["bloqueado"] == "true")
        if p.get("cpf"):
            queryset = queryset.filter(cpf__contains=so_digitos(p["cpf"]))
        if p.get("cnpj"):
            queryset = queryset.filter(cnpj__contains=limpar_cnpj(p["cnpj"]))
        if p.get("lista_preco"):
            queryset = queryset.filter(lista_preco_id=p["lista_preco"])
        if p.get("telefone"):
            fone = so_digitos(p["telefone"])
            queryset = queryset.filter(telefone__contains=fone) | queryset.filter(celular__contains=fone)
        if p.get("email"):
            queryset = queryset.filter(email__icontains=p["email"])
        return queryset

    def perform_destroy(self, instance):
        try:
            for doc in instance.documentos.all():
                doc.arquivo.delete(save=False)
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O cliente já tem movimentação. Marque Bloqueado em vez de excluir."})

    @action(
        detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser],
        url_path=r"documentos/(?P<documento_id>\d+)/arquivo",
    )
    def arquivo(self, request, pk=None, documento_id=None):
        """Anexo de um documento do cliente (campo "arquivo"); DELETE remove."""
        cliente = self.get_object()
        documento = cliente.documentos.filter(pk=documento_id).first()
        if not documento:
            raise ValidationError({"detail": "Documento não encontrado neste cliente."})
        documento.arquivo.delete(save=False)
        if request.method == "POST":
            arquivo = request.FILES.get("arquivo")
            if not arquivo or arquivo.content_type not in FORMATOS_ANEXO:
                raise ValidationError({"arquivo": "Envie um PDF ou uma imagem (PNG, JPG, WEBP)."})
            if arquivo.size > 5 * 1024 * 1024:
                raise ValidationError({"arquivo": "Arquivo maior que 5 MB. Reduza o tamanho e envie de novo."})
            documento.arquivo = arquivo
        documento.save()
        cliente.atualizado_por = request.user
        cliente.save(update_fields=["atualizado_por", "atualizado_em"])
        return Response(DocumentoClienteSerializer(documento, context={"request": request}).data)
