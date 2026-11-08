from rest_framework.routers import DefaultRouter

from .orcamentos import OrcamentoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("orcamentos", OrcamentoViewSet)

urlpatterns = router.urls
