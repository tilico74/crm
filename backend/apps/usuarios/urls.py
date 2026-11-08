from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FuncionalidadeViewSet, FuncionarioViewSet, GrupoViewSet, me

router = DefaultRouter(trailing_slash=False)
router.register("funcionarios", FuncionarioViewSet)
router.register("grupos", GrupoViewSet)
router.register("funcionalidades", FuncionalidadeViewSet)

urlpatterns = [path("auth/me", me, name="me"), *router.urls]
