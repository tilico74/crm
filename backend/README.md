# backend

API do sistema: **Python 3.12 + Django 5 + Django REST Framework**, PostgreSQL, Celery + Redis (`context/decisoes/ADR-002-backend-django.md`).

> Vazio de propósito. O esqueleto nasce na tarefa `tasks/fase-0-fundacao/T003-esqueleto-backend.md`, dentro de Docker.

## Estrutura prevista

```
backend/
├── Dockerfile
├── config/            # settings, urls, celery
├── apps/
│   ├── core/          # utilidades comuns (normalizar_nome, auditoria)
│   ├── usuarios/
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
