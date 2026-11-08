from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.empresa import EmpresaView, LogotipoView
from apps.core.views import health
from apps.vendas.views import ParametrosVendaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.usuarios.urls")),
    path("api/", include("apps.financeiro.urls")),
    path("api/empresa", EmpresaView.as_view(), name="empresa"),
    path("api/empresa/logotipo", LogotipoView.as_view(), name="empresa_logotipo"),
    path("api/parametros-venda", ParametrosVendaView.as_view(), name="parametros_venda"),
]

if settings.DEBUG:
    # Em desenvolvimento o Django serve os arquivos enviados (logotipo).
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
