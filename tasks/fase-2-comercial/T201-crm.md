# T201 — CRM

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T102 |
| Skills | `criar-tela-listagem` |
| Contexto | `context/00-visao-geral.md` |

## Objetivo

Funil de oportunidades em kanban, com etapas, responsável, próximas ações e conversão em orçamento.

## Critérios de aceite

- Ações do CRM com o ID da MarketUP
- Kanban arrastável, com teclado também

## Checklist

- [ ] Modelo e API
- [ ] Kanban
- [ ] Histórico do cliente

## Dúvidas

- [x] A tarefa pede funil kanban, mas o CRM da MarketUP é uma lista de clientes com situação financeira, última ação, histórico (Pendente/Concluído) e agenda (`context/marketup/telas-e-entidades.md`). Pela regra "na dúvida, siga a MarketUP", o kanban fica para depois da virada? Ou entra como extra?
  - **Decidido (07/11/2026):** seguir a MarketUP (lista de clientes + histórico + agenda). Kanban só depois da virada.
- [x] As colunas Vencimentos, Pagamentos e Créditos vêm do financeiro (contas a receber e limite de crédito). O CRM completo depende da T302 ou começa sem essas colunas?
  - **Decidido (07/11/2026):** o CRM começa sem as colunas financeiras; elas entram junto com a T302.
- [ ] A agenda não está em `context/03-modelo-de-dados.md`. Ela é migrada? Qual o ID na MarketUP?
