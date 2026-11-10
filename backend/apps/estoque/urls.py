from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ConsultaView, InventarioView, LocalViewSet, MotivoViewSet, MovimentacaoViewSet, TipoEstocagemViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tipos-estocagem", TipoEstocagemViewSet)
router.register("locais-estoque", LocalViewSet)
router.register("motivos-movimentacao", MotivoViewSet)
router.register("movimentacoes-estoque", MovimentacaoViewSet)

urlpatterns = router.urls + [
    path("consulta-estoque", ConsultaView.as_view(), name="consulta_estoque"),
    path("inventarios/<int:pk>", InventarioView.as_view(), name="inventario"),
]
