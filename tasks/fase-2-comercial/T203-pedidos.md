# T203 — Pedidos

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T202 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario`, `criar-api-modulo` |
| Contexto | `context/marketup/telas-e-entidades.md` (seção Pedido), `context/03-modelo-de-dados.md` |

## Objetivo

Pedidos de venda com itens, pagamento e status; ID = SaleOrderID. Gera as contas a receber; depois, OS (T204), comissão (T205) e nota (T401).

## Critérios de aceite

- Pedido nasce do orçamento ("Gerar pedido") ou direto
- Concluir venda com as validações da MarketUP e uma conta a receber por parcela
- Receber, recibo, estorno e cancelamento com retirada das contas e estorno do recebido no caixa
- Listagem com status do pedido, da entrega e do pagamento

## Checklist

- [x] Pesquisa na MarketUP (só leitura do código da tela, nada gravado): listagem, enums, ficha, concluir, pagamento, recibo, conta a receber, entregar, devolver, cancelar, orçamento → pedido. Registrado em `context/marketup/telas-e-entidades.md`.
- [x] Modelo e API (`backend/apps/vendas/pedidos.py`)
  - Orçamento e pedido herdam de `DocumentoVenda`, `ItemVenda` e `ParcelaVenda` (modelos abstratos); serializers com a base `DocumentoVendaSerializer`.
  - `Pedido`: status 1 Novo, 2 Faturado, 6 Finalizado, 7 Cancelado; `situacao_entrega` e `situacao_financeira` com os números da MarketUP; `orcamento`, `data_faturamento`, `data_entregue`. Item com `entregue`.
  - "Atrasado" (entrega e pagamento) não é gravado: sai da data na consulta, e os filtros Entrega/Financeiro respeitam isso.
  - Rótulo `situacao` como a MarketUP: Concluído = faturado + nada a entregar + saldo zero.
  - Ações: `novo` (`?orcamento=N` copia o orçamento), `gerar-parcelas`, `concluir`, `entregar`, `cancelamento` (prévia), `cancelar`, `copiar`.
- [x] Contas a receber mínimas (`backend/apps/financeiro/recebimentos.py`): `ContaReceber` (origem 7, número do pedido, conta gerencial 52 se existir), `Recebimento` (valor, juros, desconto, forma, conta corrente, estorno) e `LancamentoCaixa` (entrada do recebimento, saída do estorno). API `/contas-receber` com `receber`, `recebimentos/{id}/estornar` e `recibo`.
- [x] Aba Crédito do cliente: "utilizado" = saldo das contas a receber em aberto.
- [x] Orçamento: botão **Gerar pedido** (salva, confirma com o texto da MarketUP e abre o pedido novo com a cópia). Ao gravar o pedido o orçamento fica **Concluído** com o número do pedido; continua Concluído se o pedido for cancelado. Link "Ir para o pedido gerado".
- [x] Telas: listagem (`PedidosList`) e ficha (`PedidoForm` = a ficha do orçamento em modo pedido), com CONCLUIR / ENTREGAR / DEVOLVER, Concluir venda, pagamento faturado (Recibo, Receber, lupa, valor pendente), modais Efetuar recebimento, Emitir recibo, Cancelar com estorno e Entregar, e avisos no modal Aviso.
- [x] Impressão do pedido no mesmo modelo do orçamento (`DocumentoImpressao`) e recibo para imprimir (`/vendas/recibos/{conta}/imprimir`), com valor por extenso (`lib/extenso.ts`).
- [x] Vendedor (conferido na MarketUP): a lista vem dos funcionários vendedores e já abre com o **funcionário ligado ao usuário logado** (orçamento e pedido novos). Pedido gerado do orçamento leva o vendedor do orçamento; sem vendedor, o logado. Depois de faturado, o campo trava. Vendedores carregados com os IDs da MarketUP (M003).
- [x] Testes: 14 no backend (`tests/test_pedidos.py`) e 11 no frontend (`tests/extenso.test.ts`).
- [x] Conferência do usuário no navegador (08/11/2026).
- [x] Aparecer no Histórico do cliente (T206).

## Ficou para outras tarefas

- **Estoque (T301):** Entregar só marca os itens como entregues (sem local de estoque nem baixa); Devolver/trocar está desabilitado; o cancelamento não devolve itens ao estoque; "bloquear venda com estoque negativo" não é conferido.
- **Financeiro (T302):** tela de contas a receber (hoje o Receber abre um modal com o painel "Efetuar recebimento" e o histórico); fluxo de caixa; o recibo ainda não é enviado por e-mail.
- **Fora do escopo por ora:** Consignar, venda recorrente, retirada no local (hoje o endereço de entrega é obrigatório no Concluir), boleto (CPF/CNPJ + e-mail).
- **Nota fiscal (T401):** seção Nota Fiscal e o bloqueio do cancelamento com nota emitida.

## Dúvidas

- ~~Dúvida~~ decidido em 08/11/2026: mantido. O orçamento fica Concluído quando o pedido é **gravado** (como os dados da MarketUP mostram), não só quando o pedido é concluído. Se preferir só no Concluir venda, é uma linha no `PedidoSerializer.create`.
