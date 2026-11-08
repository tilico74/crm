# T003 — Esqueleto do back-end

| Campo | Valor |
| --- | --- |
| Status | Concluída |
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

- [x] Dockerfile do back-end
- [x] Settings por variável de ambiente
- [x] Apps vazias
- [x] Pytest configurado

## Dúvidas

- Nenhuma por enquanto.

## Observações

- O modelo `usuarios.Usuario` (vazio, herda do usuário padrão do Django) foi criado já aqui: o `AUTH_USER_MODEL` precisa existir antes da primeira migração. Perfis e permissões continuam na T101.
