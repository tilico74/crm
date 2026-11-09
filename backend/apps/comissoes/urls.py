from rest_framework.routers import DefaultRouter

from .views import ComissaoViewSet, FechamentoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("comissoes", ComissaoViewSet)
router.register("fechamentos-comissao", FechamentoViewSet)

urlpatterns = router.urls
