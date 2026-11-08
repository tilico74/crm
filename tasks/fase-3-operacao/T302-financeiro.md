# T302 — Financeiro

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T203 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario` |
| Contexto | `context/03-modelo-de-dados.md` |

## Objetivo

Contas a pagar e receber, plano de contas, contas bancárias, formas de pagamento e fluxo de caixa.

## Critérios de aceite

- Títulos em aberto migrados
- Dinheiro em decimal, nunca float

## Checklist

- [ ] Modelo e API
  - A T203 já criou `ContaReceber`, `Recebimento` e `LancamentoCaixa` (`backend/apps/financeiro/recebimentos.py`) e a API `/contas-receber` (consultar, receber, estornar, recibo). Falta incluir/alterar à mão, contas a pagar e os filtros.
- [ ] Telas
  - Tela de conta a receber como a `receivable/detail` da MarketUP; o botão RECEBER do pedido passa a abrir essa tela (hoje abre o modal "Efetuar recebimento").
  - Envio do recibo por e-mail (botão Enviar do "Emitir recibo").
- [ ] Fluxo de caixa

## Dúvidas

- Nenhuma por enquanto.
