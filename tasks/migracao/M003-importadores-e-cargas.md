# M003 — Importadores e cargas

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | M001, M002, T102, T103 |
| Skills | `validar-migracao`, `normalizar-nomes` |
| Contexto | `context/regras-de-negocio/ids-marketup.md` |

## Objetivo

Scripts de importação por entidade, na ordem das dependências, gravando o ID explícito.

## Critérios de aceite

- Cada carga validada com a skill validar-migracao
- Log com o valor original dos nomes normalizados
- Sequências ajustadas para MAX(id) + 1

## Checklist

- [ ] Tabelas auxiliares
- [ ] Cadastros
- [ ] Histórico comercial
- [ ] Comissões e financeiro
- [ ] Estoque
- [ ] XMLs de notas

## Dúvidas

- Nenhuma por enquanto.
