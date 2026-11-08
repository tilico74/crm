# T101 — Usuários e permissões

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T003, T004 |
| Skills | — |
| Contexto | `context/00-visao-geral.md` |

## Objetivo

Login, perfis (admin, vendedor, financeiro, técnico) e permissões por módulo.

## Critérios de aceite

- Login com JWT
- Cada perfil vê só os módulos permitidos
- Toda alteração registra quem fez

## Checklist

- [ ] Modelo de usuário e perfil
- [ ] Tela de login
- [ ] Gestão de usuários

## Dúvidas

- [x] Os perfis previstos aqui (admin, vendedor, financeiro, técnico) são diferentes dos 9 grupos da MarketUP (Administrador, Administrativo, Auxiliar Administrativo, Comprador, Gerente, Gerente + Administrativo, Operador PDV, Vendedor, Vendedor Redex). Seguir a MarketUP (sem Operador PDV) e acrescentar Técnico?
  - **Decidido (07/11/2026):** grupos da MarketUP, sem "Operador PDV", mais o grupo "Técnico".
- [x] Na MarketUP o usuário fica dentro do funcionário (login, senha, perfil, "Vendedor?", comissão %). Manter assim: tabela `vendedor`/funcionário com `usuario_id`, como está em `context/03-modelo-de-dados.md`?
  - **Decidido (07/11/2026):** sim, igual à MarketUP.
- [x] Permissões por funcionalidade com Acessar/Adicionar/Alterar/Excluir, como na MarketUP (`context/marketup/telas-e-entidades.md`, seção Ajustes)?
  - **Decidido (07/11/2026):** sim, mesma matriz.
