from django.db import transaction
from rest_framework import serializers

from .models import Banco, CondicaoPagamento, ContaCorrente, ContaGerencial, TipoPagamento


class ContaGerencialSerializer(serializers.ModelSerializer):
    tipo_nome = serializers.CharField(source="get_tipo_display", read_only=True)
    classificacao_dre_nome = serializers.CharField(source="get_classificacao_dre_display", read_only=True)
    conta_origem_nome = serializers.CharField(source="conta_origem.nome", default=None, read_only=True)

    class Meta:
        model = ContaGerencial
        fields = [
            "id", "tipo", "tipo_nome", "conta_origem", "conta_origem_nome", "posicao_relativa",
            "codigo_referencia", "classificacao_dre", "classificacao_dre_nome", "nome",
            "cc_debito", "cc_credito", "compras", "ativo", "sistema",
            "criado_em", "atualizado_em",
        ]
        # "Conta do sistema" vem da MarketUP (carga); não se muda pela tela.
        read_only_fields = ["sistema", "criado_em", "atualizado_em"]

    def validate_conta_origem(self, origem):
        if origem and self.instance:
            atual = origem
            while atual:
                if atual.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        "A conta não pode ficar dentro dela mesma. Escolha outra conta origem."
                    )
                atual = atual.conta_origem
        return origem


class BancoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banco
        fields = ["id", "codigo", "nome"]


class ContaCorrenteSerializer(serializers.ModelSerializer):
    banco_nome = serializers.CharField(source="banco.__str__", default=None, read_only=True)

    class Meta:
        model = ContaCorrente
        fields = [
            "id", "nome", "interna", "banco", "banco_nome", "agencia", "agencia_digito",
            "conta", "conta_digito", "principal", "ativo", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    @transaction.atomic
    def save(self, **kwargs):
        conta = super().save(**kwargs)
        # Só uma conta principal por vez: marcar uma desmarca as outras.
        if conta.principal:
            ContaCorrente.objects.filter(principal=True).exclude(pk=conta.pk).update(principal=False)
        return conta


class CondicaoPagamentoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = CondicaoPagamento
        fields = [
            "id", "descricao", "parcelas", "intervalo", "primeira_parcela", "percentual_adm",
            "percentual_antecipacao", "valor_fixo", "classificacao", "compras", "vendas",
        ]
        extra_kwargs = {
            "parcelas": {"min_value": 1, "error_messages": {"min_value": "Informe ao menos 1 parcela."}},
            "percentual_adm": {"min_value": 0, "max_value": 100},
            "percentual_antecipacao": {"min_value": 0, "max_value": 100},
            "valor_fixo": {"min_value": 0},
        }


class TipoPagamentoSerializer(serializers.ModelSerializer):
    """Ficha do tipo de pagamento com as condições: a lista enviada substitui a gravada."""

    condicoes = CondicaoPagamentoSerializer(many=True, required=False)

    class Meta:
        model = TipoPagamento
        fields = [
            "id", "descricao", "inicio_contrato", "fim_contrato", "carencia", "ativo",
            "condicoes", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        inicio = attrs.get("inicio_contrato", self.instance.inicio_contrato if self.instance else None)
        fim = attrs.get("fim_contrato", self.instance.fim_contrato if self.instance else None)
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {"fim_contrato": "O fim do contrato é anterior ao início. Corrija uma das datas."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        condicoes = validated_data.pop("condicoes", [])
        tipo = super().create(validated_data)
        self._salvar_condicoes(tipo, condicoes)
        return tipo

    @transaction.atomic
    def update(self, instance, validated_data):
        condicoes = validated_data.pop("condicoes", None)
        tipo = super().update(instance, validated_data)
        if condicoes is not None:
            self._salvar_condicoes(tipo, condicoes)
        return tipo

    def _salvar_condicoes(self, tipo, condicoes):
        usuario = tipo.atualizado_por
        existentes = {c.pk: c for c in tipo.condicoes.all()}
        manter = set()
        for dados in condicoes:
            condicao = existentes.get(dados.pop("id", None))
            if condicao:
                for campo, valor in dados.items():
                    setattr(condicao, campo, valor)
                condicao.atualizado_por = usuario
                condicao.save()
            else:
                condicao = CondicaoPagamento.objects.create(tipo=tipo, criado_por=usuario, atualizado_por=usuario, **dados)
            manter.add(condicao.pk)
        tipo.condicoes.exclude(pk__in=manter).delete()
