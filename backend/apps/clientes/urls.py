from rest_framework.routers import DefaultRouter

from .views import ClienteViewSet, ListaPrecoViewSet, TipoDocumentoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("clientes", ClienteViewSet)
router.register("listas-precos", ListaPrecoViewSet)
router.register("tipos-documento", TipoDocumentoViewSet)

urlpatterns = router.urls
