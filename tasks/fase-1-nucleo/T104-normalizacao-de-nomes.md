# T104 — Normalização de nomes

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T003, T004 |
| Skills | `normalizar-nomes` |
| Contexto | `context/regras-de-negocio/padronizacao-de-nomes.md`, `context/decisoes/ADR-005-padronizacao-nomes.md` |

## Objetivo

Implementar a função de normalização no back-end (gravação) e no front-end (prévia), usando o mesmo casos.json.

## Critérios de aceite

- Back-end e front-end passam nos 25 casos de skills/normalizar-nomes/casos.json
- Idempotente
- Lista de siglas editável pelo administrador
- Aplicada em todos os campos listados na regra

## Checklist

- [ ] Função no back-end
- [ ] Função no front-end
- [ ] Testes lendo casos.json
- [ ] Tela para editar siglas

## Dúvidas

- [ ] Corrigir acentos automaticamente? Hoje a regra não corrige ("Protecao" fica sem acento).
