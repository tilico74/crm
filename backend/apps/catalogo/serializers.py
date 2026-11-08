from django.db import transaction
from rest_framework import serializers

from .models import Categoria, Marca, Subcategoria, Unidade


class UnidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidade
        fields = ["id", "sigla", "nome", "sistema"]
        read_only_fields = ["sistema"]

    def validate_sigla(self, valor):
        return valor.strip().upper()


class MarcaSerializer(serializers.ModelSerializer):
    imagem = serializers.FileField(read_only=True)

    class Meta:
        model = Marca
        fields = ["id", "nome", "imagem"]


class SubcategoriaSerializer(serializers.ModelSerializer):
    # Opcional: sem id = subcategoria nova; com id = a existente (o ID não muda, produtos apontam para ele).
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Subcategoria
        fields = ["id", "nome", "categoria"]
        read_only_fields = ["categoria"]


class CategoriaSerializer(serializers.ModelSerializer):
    subcategorias = SubcategoriaSerializer(many=True, required=False)

    class Meta:
        model = Categoria
        fields = ["id", "nome", "subcategorias"]

    @transaction.atomic
    def create(self, validated_data):
        subcategorias = validated_data.pop("subcategorias", [])
        categoria = super().create(validated_data)
        self._gravar_subcategorias(categoria, subcategorias)
        return categoria

    @transaction.atomic
    def update(self, instance, validated_data):
        subcategorias = validated_data.pop("subcategorias", None)
        categoria = super().update(instance, validated_data)
        if subcategorias is not None:
            self._gravar_subcategorias(categoria, subcategorias)
        return categoria

    def _gravar_subcategorias(self, categoria, linhas):
        """Atualiza pelo id, cria as novas e apaga as que saíram da lista — sem trocar IDs."""
        usuario = self.context["request"].user
        existentes = {s.id: s for s in categoria.subcategorias.all()}
        mantidos = set()
        for linha in linhas:
            sub = existentes.get(linha.get("id"))
            if sub:
                sub.nome = linha["nome"]
                sub.atualizado_por = usuario
                sub.save()
            else:
                sub = Subcategoria.objects.create(categoria=categoria, nome=linha["nome"], criado_por=usuario, atualizado_por=usuario)
            mantidos.add(sub.id)
        for sub_id, sub in existentes.items():
            if sub_id not in mantidos:
                sub.delete()
