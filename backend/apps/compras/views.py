from django.db.models import ProtectedError
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet
from apps.core.documentos import limpar_cnpj, so_digitos

from .models import Fornecedor, TipoFornecedor
from .serializers import DocumentoFornecedorSerializer, FornecedorListaSerializer, FornecedorSerializer, TipoFornecedorSerializer

FORMATOS_ANEXO = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


class TipoFornecedorViewSet(AuditoriaViewSet):
    """Ajustes › Pessoas › Tipos de fornecedor; o "+" da ficha do fornecedor cadastra um novo."""

    funcionalidade = "tipos_fornecedor"
    funcionalidades_leitura = ["fornecedores"]
    queryset = TipoFornecedor.objects.all()
    serializer_class = TipoFornecedorSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_permissions(self):
        # O "+" da ficha do fornecedor cria tipo com a permissão de adicionar fornecedor (como a MarketUP).
        if self.action == "create" and self.request.user.is_authenticated and self.request.user.pode("fornecedores", "adicionar"):
            return []
        return super().get_permissions()

    def perform_destroy(self, instance):
        if instance.id == 1:
            raise ValidationError({"detail": "O tipo Geral é o padrão do sistema e não pode ser excluído."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Há fornecedores com este tipo. Troque o tipo deles antes de excluir."})


class FornecedorViewSet(AuditoriaViewSet):
    """Estoque › Compras › Fornecedores (supplier)."""

    funcionalidade = "fornecedores"
    funcionalidades_leitura = ["pedidos_compra", "orcamentos_compra", "contas_pagar", "contas_receber", "movimentacoes_estoque"]
    queryset = Fornecedor.objects.select_related("tipo")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "apelido", "cpf", "cnpj", "telefone", "celular", "email"]
    ordering_fields = ["nome", "id"]

    def get_serializer_class(self):
        return FornecedorListaSerializer if self.action == "list" else FornecedorSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            queryset = queryset.prefetch_related("enderecos", "contatos", "dados_bancarios__banco", "chaves_pix", "documentos__tipo")
        # Filtros da MarketUP: Bloqueado, CPF, CNPJ, Tipo, Telefone, E-mail, Transportador.
        p = self.request.query_params
        if p.get("bloqueado") in ("true", "false"):
            queryset = queryset.filter(bloqueado=p["bloqueado"] == "true")
        if p.get("transportadora") in ("true", "false"):
            queryset = queryset.filter(transportadora=p["transportadora"] == "true")
        if p.get("cpf"):
            queryset = queryset.filter(cpf__contains=so_digitos(p["cpf"]))
        if p.get("cnpj"):
            queryset = queryset.filter(cnpj__contains=limpar_cnpj(p["cnpj"]))
        if p.get("tipo"):
            queryset = queryset.filter(tipo_id=p["tipo"])
        if p.get("telefone"):
            fone = so_digitos(p["telefone"])
            queryset = queryset.filter(telefone__contains=fone) | queryset.filter(celular__contains=fone)
        if p.get("email"):
            queryset = queryset.filter(email__icontains=p["email"])
        return queryset

    def perform_destroy(self, instance):
        try:
            arquivos = [d.arquivo for d in instance.documentos.all() if d.arquivo]
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O fornecedor já tem movimentação. Marque Bloqueado em vez de excluir."})
        for arquivo in arquivos:
            arquivo.delete(save=False)

    @action(
        detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser],
        url_path=r"documentos/(?P<documento_id>\d+)/arquivo",
    )
    def arquivo(self, request, pk=None, documento_id=None):
        """Anexo de um documento do fornecedor (campo "arquivo"); DELETE remove."""
        fornecedor = self.get_object()
        documento = fornecedor.documentos.filter(pk=documento_id).first()
        if not documento:
            raise ValidationError({"detail": "Documento não encontrado neste fornecedor."})
        documento.arquivo.delete(save=False)
        if request.method == "POST":
            arquivo = request.FILES.get("arquivo")
            if not arquivo or arquivo.content_type not in FORMATOS_ANEXO:
                raise ValidationError({"arquivo": "Envie um PDF ou uma imagem (PNG, JPG, WEBP)."})
            if arquivo.size > 5 * 1024 * 1024:
                raise ValidationError({"arquivo": "Arquivo maior que 5 MB. Reduza o tamanho e envie de novo."})
            documento.arquivo = arquivo
        documento.save()
        fornecedor.atualizado_por = request.user
        fornecedor.save(update_fields=["atualizado_por", "atualizado_em"])
        return Response(DocumentoFornecedorSerializer(documento, context={"request": request}).data)
