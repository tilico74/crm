from django.db.models import ProtectedError
from rest_framework import filters, viewsets
from rest_framework.exceptions import ValidationError

from apps.core.api import AuditoriaViewSet

from .models import Banco, ContaCorrente, ContaGerencial, TipoPagamento
from .serializers import BancoSerializer, ContaCorrenteSerializer, ContaGerencialSerializer, TipoPagamentoSerializer


class ContaGerencialViewSet(AuditoriaViewSet):
    funcionalidade = "contas_gerenciais"
    queryset = ContaGerencial.objects.select_related("conta_origem")
    serializer_class = ContaGerencialSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "codigo_referencia"]
    ordering_fields = ["codigo_referencia", "posicao_relativa", "nome", "id"]

    def perform_destroy(self, instance):
        if instance.sistema:
            raise ValidationError({"detail": "Esta é uma conta do sistema e não pode ser excluída. Se não usa mais, desmarque Ativo."})
        if instance.subcontas.exists():
            raise ValidationError({"detail": "A conta tem contas dentro dela. Mude a conta origem delas antes de excluir."})
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "A conta já está em uso e não pode ser excluída. Desmarque Ativo para escondê-la."})


class BancoViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista de bancos para o select da conta corrente; o cadastro é pelo admin."""

    funcionalidade = "contas_correntes"
    permission_classes = AuditoriaViewSet.permission_classes
    queryset = Banco.objects.all()
    serializer_class = BancoSerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ["codigo", "nome"]


class ContaCorrenteViewSet(AuditoriaViewSet):
    funcionalidade = "contas_correntes"
    queryset = ContaCorrente.objects.select_related("banco")
    serializer_class = ContaCorrenteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "banco__nome", "conta"]
    ordering_fields = ["nome", "id"]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "A conta já tem movimentos e não pode ser excluída. Desmarque Ativo para escondê-la."})


class TipoPagamentoViewSet(AuditoriaViewSet):
    funcionalidade = "tipos_pagamento"
    queryset = TipoPagamento.objects.prefetch_related("condicoes")
    serializer_class = TipoPagamentoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descricao"]
    ordering_fields = ["descricao", "id"]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "O tipo de pagamento já está em uso e não pode ser excluído. Desmarque Ativo para escondê-lo."})
