from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.clientes.models import EnderecoCliente

from .calculo import calcular_item, calcular_orcamento, dinheiro
from .models import ItemOrcamento, Orcamento, ParcelaOrcamento


class ItemOrcamentoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    unidade_sigla = serializers.CharField(source="unidade.sigla", default=None, read_only=True)
    codigo_barras = serializers.SerializerMethodField()

    class Meta:
        model = ItemOrcamento
        fields = [
            "id", "produto", "servico", "descricao", "codigo_barras", "unidade", "unidade_sigla", "quantidade", "valor_unitario",
            "desconto", "desconto_percentual", "desconto_em_percentual", "subtotal", "total", "fragmentado", "observacao", "ordem",
        ]
        read_only_fields = ["subtotal", "total"]
        extra_kwargs = {"descricao": {"required": False, "allow_blank": True}}

    def get_codigo_barras(self, item):
        catalogo = item.produto or item.servico
        return getattr(catalogo, "codigo_barras", "") if catalogo else ""

    def validate(self, attrs):
        if bool(attrs.get("produto")) == bool(attrs.get("servico")):
            raise serializers.ValidationError("Escolha um produto ou um serviço.")
        if attrs["quantidade"] <= 0:
            raise serializers.ValidationError({"quantidade": "A quantidade tem que ser maior que zero."})
        if attrs["valor_unitario"] < 0:
            raise serializers.ValidationError({"valor_unitario": "O valor unitário não pode ser negativo."})
        catalogo = attrs.get("produto") or attrs.get("servico")
        if not attrs.get("descricao"):
            attrs["descricao"] = getattr(catalogo, "descricao", None) or getattr(catalogo, "nome", "")
        if not attrs.get("unidade"):
            attrs["unidade"] = catalogo.unidade
        # Venda fracionada (seta embaixo de "QNTD." na MarketUP): a unidade é a do produto
        # ou a da fração, se o produto é vendido fracionado; o servidor decide se é fração.
        fracao = getattr(catalogo, "fragmentacao_unidade", None)
        tem_fracao = fracao is not None and (getattr(catalogo, "fragmentacao_preco", None) or 0) > 0
        if attrs["unidade"] != catalogo.unidade and not (tem_fracao and attrs["unidade"] == fracao):
            permitidas = [catalogo.unidade.sigla] + ([fracao.sigla] if tem_fracao else [])
            raise serializers.ValidationError({"unidade": f"{attrs['descricao']}: unidade inválida. Use {' ou '.join(permitidas)}."})
        attrs["fragmentado"] = attrs["unidade"] != catalogo.unidade
        return attrs


class ParcelaOrcamentoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", read_only=True)
    condicao_pagamento_nome = serializers.CharField(source="condicao_pagamento.descricao", default=None, read_only=True)

    class Meta:
        model = ParcelaOrcamento
        fields = [
            "id", "numero", "quantidade", "vencimento", "valor", "descricao", "grupo",
            "tipo_pagamento", "tipo_pagamento_nome", "condicao_pagamento", "condicao_pagamento_nome",
        ]

    def validate_valor(self, valor):
        # MarketUP: parcela zerada é "Campo com valor inválido".
        if valor <= 0:
            raise serializers.ValidationError("Parcela com valor inválido: informe um valor maior que zero.")
        return valor


class OrcamentoListaSerializer(serializers.ModelSerializer):
    """Colunas da listagem da MarketUP: Orçamento (número + status), validade, entrega, cliente, data e valor."""

    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)

    class Meta:
        model = Orcamento
        fields = ["id", "status", "cliente", "cliente_nome", "emissao", "validade", "entrega", "data_pedido", "total", "pedido_id"]


class OrcamentoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)
    vendedor_nome = serializers.CharField(source="vendedor.nome", default=None, read_only=True)
    itens = ItemOrcamentoSerializer(many=True, required=False)
    parcelas = ParcelaOrcamentoSerializer(many=True, required=False)

    class Meta:
        model = Orcamento
        fields = [
            "id", "status", "cliente", "cliente_nome", "endereco_faturamento", "endereco_entrega", "vendedor", "vendedor_nome",
            "emissao", "validade", "entrega", "data_pedido", "data_cancelamento", "observacao",
            "subtotal", "desconto", "desconto_percentual", "desconto_em_percentual", "frete", "outros_custos", "total",
            "pedido_id", "itens", "parcelas", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["status", "data_pedido", "data_cancelamento", "subtotal", "total", "pedido_id", "criado_em", "atualizado_em"]

    def validate(self, attrs):
        if self.instance and self.instance.status != Orcamento.Status.NOVO:
            raise serializers.ValidationError(
                {"detail": f"Orçamento {self.instance.get_status_display().lower()} não pode ser alterado. Use Copiar para fazer outro."}
            )
        cliente = attrs.get("cliente", getattr(self.instance, "cliente", None))
        # Como na MarketUP: sem cliente identificado o orçamento não é salvo (o "sem cliente" é só do PDV).
        if cliente is None and (not self.partial or "cliente" in attrs):
            raise serializers.ValidationError(
                {"cliente": "Identifique o cliente: digite o nome para localizá-lo ou use Cadastrar novo cliente."}
            )
        for campo in ("endereco_faturamento", "endereco_entrega"):
            endereco: EnderecoCliente | None = attrs.get(campo)
            if endereco and (not cliente or endereco.cliente_id != cliente.id):
                raise serializers.ValidationError({campo: "O endereço não é do cliente escolhido."})
        if cliente and cliente.bloqueado:
            raise serializers.ValidationError({"cliente": "Cliente bloqueado. Desbloqueie na ficha do cliente para fazer orçamento."})
        emissao = attrs.get("emissao", getattr(self.instance, "emissao", None))
        for campo in ("validade", "entrega"):
            if attrs.get(campo) and emissao and attrs[campo] < emissao:
                raise serializers.ValidationError({campo: "A data não pode ser antes da emissão."})
        for campo in ("frete", "outros_custos", "desconto", "desconto_percentual"):
            if attrs.get(campo) is not None and attrs[campo] < 0:
                raise serializers.ValidationError({campo: "Não pode ser negativo."})

        itens = attrs.get("itens")
        if itens is not None:
            itens = [calcular_item(dict(i)) for i in itens]
            for posicao, item in enumerate(itens):
                if item["desconto"] > item["subtotal"]:
                    raise serializers.ValidationError({"itens": f"Item {posicao + 1}: o desconto é maior que o valor do item."})
            attrs["itens"] = itens
        else:
            itens = [
                {"total": i.total} for i in (self.instance.itens.all() if self.instance else [])
            ]
        base = {
            campo: attrs.get(campo, getattr(self.instance, campo, None))
            for campo in ("desconto", "desconto_percentual", "desconto_em_percentual", "frete", "outros_custos")
        }
        totais = calcular_orcamento(base, itens)
        if totais["desconto"] > totais["subtotal"]:
            raise serializers.ValidationError({"desconto": "O desconto é maior que o subtotal."})
        attrs.update(totais)

        parcelas = attrs.get("parcelas")
        if parcelas:
            soma = sum((dinheiro(p["valor"]) for p in parcelas), Decimal(0))
            if soma != totais["total"]:
                raise serializers.ValidationError(
                    {"parcelas": f"O valor total das parcelas (R$ {soma:.2f}) está diferente do valor total do orçamento (R$ {totais['total']:.2f}). Favor verificar!"}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        itens = validated_data.pop("itens", [])
        parcelas = validated_data.pop("parcelas", [])
        orcamento = super().create(validated_data)
        self._gravar(orcamento, itens, parcelas)
        return orcamento

    @transaction.atomic
    def update(self, instance, validated_data):
        itens = validated_data.pop("itens", None)
        parcelas = validated_data.pop("parcelas", None)
        orcamento = super().update(instance, validated_data)
        self._gravar(orcamento, itens, parcelas)
        return orcamento

    def _gravar(self, orcamento, itens, parcelas):
        if itens is not None:
            orcamento.itens.all().delete()
            ItemOrcamento.objects.bulk_create(
                ItemOrcamento(orcamento=orcamento, **{**{k: v for k, v in item.items() if k != "id"}, "ordem": n + 1})
                for n, item in enumerate(itens)
            )
        if parcelas is not None:
            orcamento.parcelas.all().delete()
            ParcelaOrcamento.objects.bulk_create(
                ParcelaOrcamento(orcamento=orcamento, **{k: v for k, v in p.items() if k != "id"}) for p in parcelas
            )
