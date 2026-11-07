# Arquitetura

Monólito modular: uma API, um banco, uma interface. Tudo em Docker.

```
Navegador / celular
      │
  frontend  (React + TypeScript + Refine Core + shadcn/ui)
      │  REST + JWT
  backend   (Django 5 + Django REST Framework)
   │      │        │
   db   redis    emissor fiscal (Focus NFe / eNotas)
(PostgreSQL) │
          worker (Celery: importações, comissões, e-mails)
```

| Camada | Escolha | ADR |
| --- | --- | --- |
| Contêineres | Docker + Docker Compose | ADR-001 |
| Back-end | Python 3.12, Django 5, DRF, Celery + Redis | ADR-002 |
| Front-end | React, TypeScript, Refine Core, shadcn/ui, Tabler Icons | ADR-003 |
| Banco | PostgreSQL | ADR-002 |
| Arquivos | S3 ou compatível (MinIO em desenvolvimento) | ADR-001 |

> As escolhas estão decididas, mas **nada foi instalado**. A instalação começa nas tarefas da fase 0.
