from rest_framework.routers import DefaultRouter

from .views import BancoViewSet, ContaCorrenteViewSet, ContaGerencialViewSet, TipoPagamentoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("contas-gerenciais", ContaGerencialViewSet)
router.register("bancos", BancoViewSet)
router.register("contas-correntes", ContaCorrenteViewSet)
router.register("tipos-pagamento", TipoPagamentoViewSet)

urlpatterns = router.urls
