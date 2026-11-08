# backend

API do sistema: **Python 3.12 + Django 5.2 + Django REST Framework**, PostgreSQL 17, Celery + Redis (`context/decisoes/ADR-002-backend-django.md`).

## Bibliotecas

| Biblioteca | Para quê |
| --- | --- |
| Django 5.2 (LTS) | Framework, ORM e Django Admin |
| django-unfold | Tema do Django Admin |
| djangorestframework | API REST |
| djangorestframework-simplejwt | Login por JWT (`/api/auth/token/`) |
| django-filter | Filtros nas listagens da API |
| django-cors-headers | Libera o front-end a chamar a API |
| drf-spectacular | Documentação da API (`/api/docs/`) |
| django-environ | Configuração pelo `.env` |
| psycopg 3 | Driver do PostgreSQL |
| celery[redis] | Tarefas em segundo plano |
| django-storages[s3] | Arquivos em S3 ou compatível (ativo quando `S3_BUCKET` estiver preenchido) |
| gunicorn | Servidor de produção |
| pytest + pytest-django | Testes |

Versões em `requirements.txt`.

## Comandos (sempre via Docker)

- Testes: `docker compose exec backend pytest`
- Migrações: `docker compose exec backend python manage.py makemigrations` / `migrate`
- Shell: `docker compose exec backend python manage.py shell`

## Estrutura

```
backend/
├── Dockerfile
├── requirements.txt
├── config/            # settings, urls, celery
├── apps/
│   ├── core/          # utilidades comuns (normalizar_nome, auditoria) e /api/health
│   ├── usuarios/      # modelo Usuario (AUTH_USER_MODEL); perfis na T101
│   ├── clientes/
│   ├── catalogo/
│   ├── crm/
│   ├── vendas/        # orçamentos e pedidos
│   ├── servicos/      # ordens de serviço
│   ├── comissoes/
│   ├── estoque/
│   ├── financeiro/
│   ├── fiscal/
│   └── migracao/      # importadores da MarketUP
└── tests/
```

`DEFAULT_AUTO_FIELD` é `BigAutoField`: chaves BIGINT, iguais às da MarketUP (ADR-004).
