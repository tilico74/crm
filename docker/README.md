# docker

Configuração compartilhada de contêineres. Tudo no projeto roda em Docker para que o sistema seja exportado e instalado igual em qualquer máquina (`context/decisoes/ADR-001-docker.md`). O arquivo principal é o `docker-compose.yml` na raiz.

## Primeira vez

1. Instale o Docker Desktop (Windows: com WSL 2).
2. Na raiz do projeto: `copy .env.example .env` e preencha as senhas e o `DJANGO_SECRET_KEY`.

## Comandos

| Ação | Comando |
| --- | --- |
| Subir | `docker compose up -d` |
| Parar | `docker compose down` |
| Ver logs | `docker compose logs -f` |

Endereços: interface em http://localhost:5174, API em http://localhost:8000/api, documentação da API em http://localhost:8000/api/docs/, painel interno em http://localhost:8000/admin/.

Criar o primeiro usuário do painel: `docker compose exec backend python manage.py createsuperuser`.

## Serviços

| Serviço | Imagem / origem | Função |
| --- | --- | --- |
| `db` | `postgres:17-alpine` | Banco de dados (volume nomeado `db_data`) |
| `redis` | `redis:7.4-alpine` | Fila das tarefas em segundo plano |
| `backend` | `backend/Dockerfile` | API Django (aplica as migrações ao subir) |
| `worker` | `backend/Dockerfile` | Celery (importações, comissões) |
| `frontend` | `frontend/Dockerfile` | Interface React (Vite) |

> Arquivos (S3/MinIO): sem serviço local por enquanto. Ver "Dúvidas" na T002.

> Porta 5174 porque a 5173 é usada por outro projeto nesta máquina. Para trocar, mude `FRONTEND_PORT` no `.env`.
