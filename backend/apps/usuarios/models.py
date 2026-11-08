from django.contrib.auth.models import AbstractUser


class Usuario(AbstractUser):
    """Usuário do sistema. Perfis e permissões entram na tarefa T101."""

    class Meta:
        db_table = "usuario"
        verbose_name = "usuário"
        verbose_name_plural = "usuários"
