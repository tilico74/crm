from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api import PermissaoFuncionalidade

from .models import ParametrosVenda


class ParametrosVendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametrosVenda
        exclude = ["id", "criado_em", "criado_por", "atualizado_por"]
        read_only_fields = ["atualizado_em"]


class ParametrosVendaView(APIView):
    """Ajustes › Empresa › Parâmetros de venda (registro único)."""

    funcionalidade = "parametros_venda"
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        return Response(ParametrosVendaSerializer(ParametrosVenda.atual()).data)

    def patch(self, request):
        serializer = ParametrosVendaSerializer(ParametrosVenda.atual(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(atualizado_por=request.user)
        return Response(serializer.data)
