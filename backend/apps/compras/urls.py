from rest_framework.routers import DefaultRouter

from .views import FornecedorViewSet, TipoFornecedorViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tipos-fornecedor", TipoFornecedorViewSet)
router.register("fornecedores", FornecedorViewSet)

urlpatterns = router.urls
