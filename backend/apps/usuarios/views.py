from django.db import transaction
from rest_framework import filters, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api import AuditoriaViewSet, PermissaoFuncionalidade

from .models import Funcionalidade, Funcionario, Grupo, PermissaoGrupo
from .serializers import (
    FuncionalidadeSerializer,
    FuncionarioSerializer,
    GrupoSerializer,
    MeSerializer,
    PermissaoGrupoSerializer,
)


@api_view(["GET"])
def me(request):
    return Response(MeSerializer(request.user).data)


class FuncionarioViewSet(AuditoriaViewSet):
    funcionalidade = "funcionarios"
    queryset = Funcionario.objects.select_related("usuario__grupo")
    serializer_class = FuncionarioSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome", "apelido", "codigo", "cpf", "email"]
    ordering_fields = ["nome", "codigo", "id"]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Tela Usuários: só funcionários com login.
        if self.request.query_params.get("com_login"):
            queryset = queryset.filter(usuario__isnull=False)
        return queryset

    def perform_destroy(self, instance):
        # O login some junto: o usuário fica inativo (não é apagado, para manter o histórico).
        usuario = instance.usuario
        instance.delete()
        if usuario:
            usuario.is_active = False
            usuario.save(update_fields=["is_active"])


class GrupoViewSet(AuditoriaViewSet):
    funcionalidade = "permissoes"
    funcionalidades_leitura = ["funcionarios"]
    queryset = Grupo.objects.all()
    serializer_class = GrupoSerializer

    def perform_destroy(self, instance):
        if instance.usuarios.exists():
            raise ValidationError({"detail": "O grupo tem usuários. Mude o grupo deles antes de excluir."})
        instance.delete()

    @action(detail=True, methods=["get", "put"])
    def permissoes(self, request, pk=None):
        """GET: a matriz do grupo. PUT: grava a matriz inteira (lista de linhas)."""
        grupo = self.get_object()
        if request.method == "PUT":
            serializer = PermissaoGrupoSerializer(data=request.data, many=True)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                grupo.permissoes.all().delete()
                PermissaoGrupo.objects.bulk_create(PermissaoGrupo(grupo=grupo, **linha) for linha in serializer.validated_data)
                grupo.atualizado_por = request.user
                grupo.save(update_fields=["atualizado_por", "atualizado_em"])
        linhas = grupo.permissoes.select_related("funcionalidade")
        return Response(PermissaoGrupoSerializer(linhas, many=True).data)


class FuncionalidadeViewSet(viewsets.ReadOnlyModelViewSet):
    funcionalidade = "permissoes"
    permission_classes = [PermissaoFuncionalidade]
    queryset = Funcionalidade.objects.all()
    serializer_class = FuncionalidadeSerializer
    pagination_class = None
