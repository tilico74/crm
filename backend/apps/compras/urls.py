from rest_framework.routers import DefaultRouter

from .pedidos import PedidoCompraViewSet
from .views import FornecedorViewSet, TipoFornecedorViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tipos-fornecedor", TipoFornecedorViewSet)
router.register("fornecedores", FornecedorViewSet)
router.register("pedidos-compra", PedidoCompraViewSet, basename="pedidos-compra")

urlpatterns = router.urls
