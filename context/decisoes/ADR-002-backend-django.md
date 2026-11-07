# ADR-002: Back-end em Python + Django

- **Status:** Aceito em 07/11/2026.

## Decisão

Python 3.12, Django 5 e Django REST Framework, com Django ORM, autenticação JWT (SimpleJWT) e Celery + Redis para tarefas em segundo plano. Banco PostgreSQL. Painel interno com Django Admin + tema Unfold.

## Por quê

- Desenvolvimento rápido, com ORM maduro.
- O Django Admin já resolve cadastros e suporte desde o primeiro dia.
- É fácil inserir registros com IDs explícitos e reajustar as sequências, o que a compatibilidade com a MarketUP exige.

Alternativa registrada: FastAPI + SQLAlchemy.
