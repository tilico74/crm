"""Ajustes › Empresa › Informações da empresa (registro único)."""

from django.db import transaction
from rest_framework import serializers
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .api import PermissaoFuncionalidade
from .documentos import CepField, CnpjField, TelefoneField
from .models import Empresa, EnderecoEmpresa

FORMATOS_LOGO = {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}
TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024


class EnderecoEmpresaSerializer(serializers.ModelSerializer):
    cep = CepField()

    class Meta:
        model = EnderecoEmpresa
        fields = ["tipo", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "ibge"]


class EmpresaSerializer(serializers.ModelSerializer):
    cnpj = CnpjField()
    telefone = TelefoneField()
    whatsapp = TelefoneField()
    enderecos = EnderecoEmpresaSerializer(many=True, required=False)
    logotipo = serializers.FileField(read_only=True)

    class Meta:
        model = Empresa
        fields = [
            "cnpj", "nome_fantasia", "razao_social", "email", "telefone", "whatsapp", "area_atuacao",
            "inscricao_estadual", "inscricao_municipal", "logotipo", "fuso_horario", "horario_verao",
            "produtor_rural", "enderecos", "atualizado_em",
        ]
        read_only_fields = ["atualizado_em"]

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        # Sempre os 3 endereços, na ordem da MarketUP, mesmo os ainda vazios.
        existentes = {e["tipo"]: e for e in dados["enderecos"]}
        dados["enderecos"] = [
            existentes.get(tipo, {"tipo": tipo, **{c: "" for c in EnderecoEmpresaSerializer.Meta.fields if c != "tipo"}})
            for tipo in EnderecoEmpresa.Tipo.values
        ]
        return dados

    @transaction.atomic
    def update(self, instance, validated_data):
        enderecos = validated_data.pop("enderecos", None)
        instance = super().update(instance, validated_data)
        for dados in enderecos or []:
            endereco, _ = EnderecoEmpresa.objects.get_or_create(empresa=instance, tipo=dados["tipo"])
            for campo, valor in dados.items():
                setattr(endereco, campo, valor)
            endereco.save()
        return instance


class EmpresaView(APIView):
    funcionalidade = "empresa"
    funcionalidades_leitura = ["orcamentos"]  # cabeçalho da impressão do orçamento
    permission_classes = [PermissaoFuncionalidade]

    def get(self, request):
        return Response(EmpresaSerializer(Empresa.atual(), context={"request": request}).data)

    def patch(self, request):
        serializer = EmpresaSerializer(Empresa.atual(), data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(atualizado_por=request.user)
        return Response(serializer.data)


class LogotipoView(APIView):
    """Envio do logotipo (multipart, campo "arquivo"). DELETE remove."""

    funcionalidade = "empresa"
    permission_classes = [PermissaoFuncionalidade]
    parser_classes = [MultiPartParser]

    def post(self, request):
        arquivo = request.FILES.get("arquivo")
        if not arquivo:
            raise serializers.ValidationError({"arquivo": "Escolha uma imagem para o logotipo."})
        if arquivo.content_type not in FORMATOS_LOGO:
            raise serializers.ValidationError({"arquivo": "Formato não aceito. Use PNG, JPG, SVG ou WEBP."})
        if arquivo.size > TAMANHO_MAXIMO_LOGO:
            raise serializers.ValidationError({"arquivo": "Imagem maior que 2 MB. Reduza o tamanho e envie de novo."})
        empresa = Empresa.atual()
        empresa.logotipo.delete(save=False)
        empresa.logotipo = arquivo
        empresa.atualizado_por = request.user
        empresa.save()
        return Response(EmpresaSerializer(empresa, context={"request": request}).data)

    def delete(self, request):
        empresa = Empresa.atual()
        empresa.logotipo.delete(save=False)
        empresa.atualizado_por = request.user
        empresa.save()
        return Response(EmpresaSerializer(empresa, context={"request": request}).data)
