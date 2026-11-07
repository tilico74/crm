# T003 — Esqueleto do back-end

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T002 |
| Skills | `executar-em-docker` |
| Contexto | `context/decisoes/ADR-002-backend-django.md`, `backend/README.md` |

## Objetivo

Criar o projeto Django com DRF, JWT, Celery e as apps vazias da estrutura prevista.

## Critérios de aceite

- `/api/health` responde 200 dentro do Docker
- Django Admin com tema Unfold acessível
- Apps criadas sem modelos ainda
- Testes rodam com `docker compose exec backend pytest`

## Checklist

- [ ] Dockerfile do back-end
- [ ] Settings por variável de ambiente
- [ ] Apps vazias
- [ ] Pytest configurado

## Dúvidas

- Nenhuma por enquanto.
