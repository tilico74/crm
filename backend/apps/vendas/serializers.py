from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.clientes.models import EnderecoCliente

from .calculo import calcular_item, calcular_orcamento, dinheiro
from .models import ItemOrcamento, ItemPedido, Orcamento, ParcelaOrcamento, ParcelaPedido, Pedido

# ---- Base comum do orçamento e do pedido ----

CAMPOS_ITEM = [
    "id", "produto", "servico", "descricao", "codigo_barras", "unidade", "unidade_sigla", "quantidade", "valor_unitario",
    "desconto", "desconto_percentual", "desconto_em_percentual", "subtotal", "total", "fragmentado", "observacao", "ordem",
]
CAMPOS_PARCELA = [
    "id", "numero", "quantidade", "vencimento", "valor", "descricao", "grupo",
    "tipo_pagamento", "tipo_pagamento_nome", "condicao_pagamento", "condicao_pagamento_nome",
]
CAMPOS_DOCUMENTO = [
    "id", "status", "cliente", "cliente_nome", "endereco_faturamento", "endereco_entrega", "vendedor", "vendedor_nome",
    "emissao", "entrega", "data_cancelamento", "observacao",
    "subtotal", "desconto", "desconto_percentual", "desconto_em_percentual", "frete", "outros_custos", "total",
    "itens", "parcelas", "criado_em", "atualizado_em",
]


class ItemVendaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    unidade_sigla = serializers.CharField(source="unidade.sigla", default=None, read_only=True)
    codigo_barras = serializers.SerializerMethodField()

    class Meta:
        fields = CAMPOS_ITEM
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


class ParcelaVendaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    tipo_pagamento_nome = serializers.CharField(source="tipo_pagamento.descricao", read_only=True)
    condicao_pagamento_nome = serializers.CharField(source="condicao_pagamento.descricao", default=None, read_only=True)

    class Meta:
        fields = CAMPOS_PARCELA

    def validate_valor(self, valor):
        # MarketUP: parcela zerada é "Campo com valor inválido".
        if valor <= 0:
            raise serializers.ValidationError("Parcela com valor inválido: informe um valor maior que zero.")
        return valor


class DocumentoVendaSerializer(serializers.ModelSerializer):
    """Validação e gravação comuns. As subclasses dizem o nome do documento e os modelos de item e parcela."""

    nome_documento = "documento"
    modelo_item = None
    modelo_parcela = None
    campo_pai = None

    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)
    vendedor_nome = serializers.CharField(source="vendedor.nome", default=None, read_only=True)

    def validate(self, attrs):
        if self.instance and self.instance.status != 1:  # só o Novo se altera
            raise serializers.ValidationError(
                {"detail": f"{self.nome_documento.capitalize()} {self.instance.get_status_display().lower()} não pode ser alterado. Use Copiar para fazer outro."}
            )
        cliente = attrs.get("cliente", getattr(self.instance, "cliente", None))
        # Como na MarketUP: sem cliente identificado o documento não é salvo (o "sem cliente" é só do PDV).
        if cliente is None and (not self.partial or "cliente" in attrs):
            raise serializers.ValidationError(
                {"cliente": "Identifique o cliente: digite o nome para localizá-lo ou use Cadastrar novo cliente."}
            )
        for campo in ("endereco_faturamento", "endereco_entrega"):
            endereco: EnderecoCliente | None = attrs.get(campo)
            if endereco and (not cliente or endereco.cliente_id != cliente.id):
                raise serializers.ValidationError({campo: "O endereço não é do cliente escolhido."})
        if cliente and cliente.bloqueado:
            raise serializers.ValidationError({"cliente": f"Cliente bloqueado. Desbloqueie na ficha do cliente para fazer {self.nome_documento}."})
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
            itens = [{"total": i.total} for i in (self.instance.itens.all() if self.instance else [])]
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
                    {"parcelas": f"O valor total das parcelas (R$ {soma:.2f}) está diferente do valor total do {self.nome_documento} (R$ {totais['total']:.2f}). Favor verificar!"}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        itens = validated_data.pop("itens", [])
        parcelas = validated_data.pop("parcelas", [])
        documento = super().create(validated_data)
        self._gravar(documento, itens, parcelas)
        return documento

    @transaction.atomic
    def update(self, instance, validated_data):
        itens = validated_data.pop("itens", None)
        parcelas = validated_data.pop("parcelas", None)
        documento = super().update(instance, validated_data)
        self._gravar(documento, itens, parcelas)
        return documento

    def _gravar(self, documento, itens, parcelas):
        if itens is not None:
            documento.itens.all().delete()
            self.modelo_item.objects.bulk_create(
                self.modelo_item(**{self.campo_pai: documento}, **{**{k: v for k, v in item.items() if k != "id"}, "ordem": n + 1})
                for n, item in enumerate(itens)
            )
        if parcelas is not None:
            documento.parcelas.all().delete()
            self.modelo_parcela.objects.bulk_create(
                self.modelo_parcela(**{self.campo_pai: documento}, **{k: v for k, v in p.items() if k != "id"}) for p in parcelas
            )


# ---- Orçamento ----


class ItemOrcamentoSerializer(ItemVendaSerializer):
    class Meta(ItemVendaSerializer.Meta):
        model = ItemOrcamento


class ParcelaOrcamentoSerializer(ParcelaVendaSerializer):
    class Meta(ParcelaVendaSerializer.Meta):
        model = ParcelaOrcamento


class OrcamentoListaSerializer(serializers.ModelSerializer):
    """Colunas da listagem da MarketUP: Orçamento (número + status), validade, entrega, cliente, data e valor."""

    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)

    class Meta:
        model = Orcamento
        fields = ["id", "status", "cliente", "cliente_nome", "emissao", "validade", "entrega", "data_pedido", "total", "pedido_id"]


class OrcamentoSerializer(DocumentoVendaSerializer):
    nome_documento = "orçamento"
    modelo_item = ItemOrcamento
    modelo_parcela = ParcelaOrcamento
    campo_pai = "orcamento"

    itens = ItemOrcamentoSerializer(many=True, required=False)
    parcelas = ParcelaOrcamentoSerializer(many=True, required=False)

    class Meta:
        model = Orcamento
        fields = CAMPOS_DOCUMENTO + ["validade", "data_pedido", "pedido_id"]
        read_only_fields = ["status", "data_pedido", "data_cancelamento", "subtotal", "total", "pedido_id", "criado_em", "atualizado_em"]


# ---- Pedido ----


class ItemPedidoSerializer(ItemVendaSerializer):
    class Meta(ItemVendaSerializer.Meta):
        model = ItemPedido
        fields = CAMPOS_ITEM + ["entregue"]
        read_only_fields = ["subtotal", "total", "entregue"]


class ParcelaPedidoSerializer(ParcelaVendaSerializer):
    """Depois de concluída a venda, a parcela mostra o saldo e a conta a receber (EventID) dela."""

    saldo = serializers.SerializerMethodField()
    conta_receber = serializers.SerializerMethodField()
    ultimo_recebimento = serializers.SerializerMethodField()

    class Meta(ParcelaVendaSerializer.Meta):
        model = ParcelaPedido
        fields = CAMPOS_PARCELA + ["saldo", "conta_receber", "ultimo_recebimento"]

    def _conta(self, parcela):
        if not parcela.pk:
            return None
        contas = [c for c in parcela.contas.all() if not c.cancelada]
        return contas[0] if contas else None

    def get_saldo(self, parcela):
        conta = self._conta(parcela)
        return f"{(conta.saldo if conta else parcela.valor):.2f}"

    def get_conta_receber(self, parcela):
        conta = self._conta(parcela)
        return conta.id if conta else None

    def get_ultimo_recebimento(self, parcela):
        conta = self._conta(parcela)
        datas = [r.data for r in conta.recebimentos.all() if not r.estornado_em] if conta else []
        return max(datas) if datas else None


def situacoes(pedido: Pedido) -> dict:
    """
    Status mostrados na tela, como a MarketUP calcula (getStatusClass / getListStatusClass):
    - "Concluído" = faturado sem nada a entregar e sem saldo a receber; senão "Faturado".
    - Entrega e pagamento "Atrasado" saem da data: entrega prevista vencida / parcela vencida com saldo.
    """
    hoje = timezone.localdate()
    a_entregar = sum((max(i.quantidade - i.entregue, 0) for i in pedido.itens.all() if i.produto_id), Decimal(0))
    saldo = Decimal(0)
    vencida = False
    for parcela in pedido.parcelas.all():
        contas = [c for c in parcela.contas.all() if not c.cancelada]
        if contas:
            saldo += contas[0].saldo
            vencida = vencida or (contas[0].saldo > 0 and contas[0].vencimento < hoje)
    entrega = pedido.situacao_entrega
    if entrega == Pedido.Entrega.PENDENTE and pedido.status == Pedido.Status.FATURADO and pedido.entrega and pedido.entrega < hoje:
        entrega = Pedido.Entrega.ATRASADO
    financeiro = pedido.situacao_financeira
    if financeiro in (Pedido.Financeiro.PENDENTE, Pedido.Financeiro.PARCIAL) and vencida:
        financeiro = Pedido.Financeiro.ATRASADO
    if pedido.status in (Pedido.Status.FATURADO, Pedido.Status.FINALIZADO):
        rotulo = "concluido" if a_entregar <= 0 and saldo < Decimal("0.001") else "faturado"
    else:
        rotulo = {Pedido.Status.NOVO: "novo", Pedido.Status.CANCELADO: "cancelado"}.get(pedido.status, "novo")
    return {
        "situacao": rotulo,
        "entrega_status": entrega,
        "financeiro_status": financeiro,
        "a_entregar": f"{a_entregar:.3f}",
        "saldo_receber": f"{saldo:.2f}",
    }


class PedidoListaSerializer(serializers.ModelSerializer):
    """Colunas da listagem da MarketUP: Pedido (número + status), Status (emitido/faturado em), Cliente, Entrega, Valor."""

    cliente_nome = serializers.CharField(source="cliente.nome", default=None, read_only=True)

    class Meta:
        model = Pedido
        fields = ["id", "status", "cliente", "cliente_nome", "emissao", "data_faturamento", "entrega", "total", "orcamento"]

    def to_representation(self, pedido):
        return {**super().to_representation(pedido), **situacoes(pedido)}


class PedidoSerializer(DocumentoVendaSerializer):
    nome_documento = "pedido"
    modelo_item = ItemPedido
    modelo_parcela = ParcelaPedido
    campo_pai = "pedido"

    itens = ItemPedidoSerializer(many=True, required=False)
    parcelas = ParcelaPedidoSerializer(many=True, required=False)

    class Meta:
        model = Pedido
        fields = CAMPOS_DOCUMENTO + ["situacao_entrega", "situacao_financeira", "orcamento", "data_faturamento", "data_entregue"]
        read_only_fields = [
            "status", "situacao_entrega", "situacao_financeira", "data_faturamento", "data_entregue", "data_cancelamento",
            "subtotal", "total", "criado_em", "atualizado_em",
        ]

    def validate_orcamento(self, orcamento):
        if orcamento is None:
            return None
        if self.instance and self.instance.orcamento_id == orcamento.id:
            return orcamento
        if self.instance and self.instance.orcamento_id:
            raise serializers.ValidationError("O orçamento de origem não muda.")
        if orcamento.status != Orcamento.Status.NOVO:
            raise serializers.ValidationError(
                f"O orçamento Nº {orcamento.id} está {orcamento.get_status_display().lower()} e não gera outro pedido."
            )
        return orcamento

    @transaction.atomic
    def create(self, validated_data):
        pedido = super().create(validated_data)
        # Orçamento de origem: ao gravar o pedido, o orçamento fica Concluído e aponta para o pedido
        # (como os orçamentos 3736, 3868 e 3869 da MarketUP). Continua Concluído mesmo se o pedido for cancelado.
        if pedido.orcamento_id:
            Orcamento.objects.filter(pk=pedido.orcamento_id).update(
                status=Orcamento.Status.CONCLUIDO, pedido_id=pedido.id, data_pedido=timezone.now(),
                atualizado_por=pedido.criado_por, atualizado_em=timezone.now(),
            )
        return pedido

    def to_representation(self, pedido):
        return {**super().to_representation(pedido), **situacoes(pedido)}
