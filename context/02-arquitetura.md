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
                  ViaCEP e IBGE (CEP, estados, municípios — ADR-006)
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

> Instalado na fase 0 (T002–T004): PostgreSQL 17, Redis 7.4, Python 3.12, Django 5.2, React 19, Refine 5, Tailwind 4. O serviço local de arquivos (MinIO) está pendente: ver T002.
