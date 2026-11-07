# docker

Configuração compartilhada de contêineres. Tudo no projeto roda em Docker para que o sistema seja exportado e instalado igual em qualquer máquina (`context/decisoes/ADR-001-docker.md`).

> Vazio de propósito. Os arquivos nascem na tarefa `tasks/fase-0-fundacao/T002-docker-compose.md`.

## Serviços previstos

| Serviço | Imagem / origem | Função |
| --- | --- | --- |
| `db` | PostgreSQL | Banco de dados |
| `redis` | Redis | Fila das tarefas em segundo plano |
| `backend` | `backend/Dockerfile` | API Django |
| `worker` | `backend/Dockerfile` | Celery (importações, comissões) |
| `frontend` | `frontend/Dockerfile` | Interface React |
