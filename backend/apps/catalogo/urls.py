from rest_framework.routers import DefaultRouter

from .views import CategoriaViewSet, MarcaViewSet, ProdutoViewSet, ServicoViewSet, SubcategoriaViewSet, UnidadeViewSet

router = DefaultRouter(trailing_slash=False)
router.register("unidades", UnidadeViewSet)
router.register("marcas", MarcaViewSet)
router.register("categorias", CategoriaViewSet)
router.register("subcategorias", SubcategoriaViewSet)
router.register("produtos", ProdutoViewSet)
router.register("servicos", ServicoViewSet)

urlpatterns = router.urls
