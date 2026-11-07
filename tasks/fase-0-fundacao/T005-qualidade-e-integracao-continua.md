# T005 — Qualidade e integração contínua

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T003, T004 |
| Skills | — |
| Contexto | `AGENTS.md` |

## Objetivo

Configurar lint, formatação e testes automáticos a cada envio de código.

## Critérios de aceite

- Lint e testes rodam no CI dentro de Docker
- O CI falha se `casos.json` de normalizar-nomes não passar no back-end e no front-end

## Checklist

- [ ] Lint Python e TypeScript
- [ ] Pipeline de CI
- [ ] Badge de status no README

## Dúvidas

- Nenhuma por enquanto.
