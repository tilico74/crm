from rest_framework import viewsets
from rest_framework.permissions import BasePermission


class PermissaoFuncionalidade(BasePermission):
    """
    Confere a matriz de permissões da MarketUP: grupo × funcionalidade × ação.
    A view declara `funcionalidade = "<codigo>"`; o método HTTP define a ação.
    """

    ACOES = {
        "GET": "acessar",
        "HEAD": "acessar",
        "OPTIONS": "acessar",
        "POST": "adicionar",
        "PUT": "alterar",
        "PATCH": "alterar",
        "DELETE": "excluir",
    }

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        acao = self.ACOES.get(request.method, "acessar")
        codigos = [getattr(view, "funcionalidade", None)]
        # Leitura liberada também por outras funcionalidades (ex.: grupos no cadastro de funcionário).
        if acao == "acessar":
            codigos += getattr(view, "funcionalidades_leitura", [])
        codigos = [c for c in codigos if c]
        if not codigos:
            return True
        return any(user.pode(c, acao) for c in codigos)


class AuditoriaViewSet(viewsets.ModelViewSet):
    """Grava quem criou e quem alterou cada registro (ModeloBase)."""

    permission_classes = [PermissaoFuncionalidade]

    def perform_create(self, serializer):
        serializer.save(criado_por=self.request.user, atualizado_por=self.request.user)

    def perform_update(self, serializer):
        serializer.save(atualizado_por=self.request.user)
