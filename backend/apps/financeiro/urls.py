from django.urls import path
from rest_framework.routers import DefaultRouter

from .caixa import FluxoCaixaView, MovimentacaoView, TransferenciaView
from .recebimentos import ContaPagarViewSet, ContaReceberViewSet
from .views import BancoViewSet, ContaCorrenteViewSet, ContaGerencialViewSet, TipoPagamentoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("contas-gerenciais", ContaGerencialViewSet)
router.register("bancos", BancoViewSet)
router.register("contas-correntes", ContaCorrenteViewSet)
router.register("tipos-pagamento", TipoPagamentoViewSet)
router.register("contas-receber", ContaReceberViewSet, basename="contareceber")
router.register("contas-pagar", ContaPagarViewSet, basename="contapagar")

urlpatterns = router.urls + [
    path("movimentacao-caixa", MovimentacaoView.as_view(), name="movimentacao_caixa"),
    path("transferencias", TransferenciaView.as_view(), name="transferencias"),
    path("fluxo-caixa", FluxoCaixaView.as_view(), name="fluxo_caixa"),
]
