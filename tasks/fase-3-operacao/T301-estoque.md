# T301 — Estoque

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T103 |
| Skills | `criar-tela-listagem` |
| Contexto | `context/03-modelo-de-dados.md` |

## Objetivo

Saldo por local, movimentações, baixa automática por pedido e OS, inventário.

## Critérios de aceite

- Saldo inicial migrado na data de corte

## Checklist

- [ ] Modelo e API
- [ ] Telas
- [ ] Pedido (T203): o modal "Entregar pedido" ganha local de estoque e quantidade por item, com baixa no estoque (hoje só marca tudo como entregue); **Devolver / troca** (modal "DEVOLUÇÃO / TROCA" da MarketUP, com estorno); cancelamento devolve os itens entregues ao local escolhido; "bloquear venda com estoque negativo" no Concluir venda. Regras em `context/marketup/telas-e-entidades.md` (Pedido › Entregar e devolver).

## Dúvidas

- Nenhuma por enquanto.
