from rest_framework.routers import DefaultRouter

from .orcamentos import OrcamentoViewSet
from .pedidos import PedidoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("orcamentos", OrcamentoViewSet)
router.register("pedidos", PedidoViewSet, basename="pedido")

urlpatterns = router.urls
