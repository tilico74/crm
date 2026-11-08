from django.urls import path

from .localidades import CepView, EnderecosView, EstadosView, MunicipiosView

urlpatterns = [
    path("localidades/cep/<str:cep>", CepView.as_view(), name="localidades_cep"),
    path("localidades/enderecos", EnderecosView.as_view(), name="localidades_enderecos"),
    path("localidades/estados", EstadosView.as_view(), name="localidades_estados"),
    path("localidades/estados/<str:uf>/municipios", MunicipiosView.as_view(), name="localidades_municipios"),
]
