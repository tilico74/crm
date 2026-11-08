# T206 — Histórico do cliente com orçamentos, pedidos e OS

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T102, T202, T203, T204 |
| Skills | `criar-api-modulo`, `criar-tela-formulario` |
| Contexto | `context/marketup/telas-e-entidades.md` (Cliente › Histórico) |

## Objetivo

A aba **Histórico** da ficha do cliente mostra, junto com as anotações digitadas, uma linha para cada orçamento, pedido e ordem de serviço do cliente, com a situação atual e a lupa que abre o documento, como na MarketUP.

## Como a MarketUP faz (conferido no cliente 786 em 08/11/2026, só leitura)

- Lista: `currentClient.ClientHistoryList`, carregada aos poucos ("Ver mais registros" → `GetClientHistoryPagedList`, página a página).
- Cada linha tem: `Date`, `Observation` (texto, ex.: "ORÇAMENTO Nº000826"), `Status` (texto da situação do documento, ex.: "NOVO", "CONCLUÍDO"), `HistoryStatus`, `OriginID`, `Key` (número do documento), `OportunityID`, `DueDate`, `DueValue`.
- Linhas automáticas têm `ClientHistoryID` negativo: são montadas na consulta, não ficam gravadas, e não se editam nem se excluem.
- Origens (`ClientHistoryOriginEnum`), com o que a lupa (`goToHistory`) abre:

| Origem | OriginID | Lupa abre |
| --- | --- | --- |
| Orçamento | −8 | `sale_budget/detail/{Key}` |
| Pedido de venda | 8 | `sale_order/detail/{Key}` |
| PDV (cupom) | 7 | `coupon` (fora do escopo do RDX) |
| Loja virtual | 10 | `sale_order` (fora do escopo) |

- Status das anotações manuais (`ClientHistoryStatusEnum`): 0 Excluído, 1 Pendente, 2 Concluído.
- **A MarketUP não põe a ordem de serviço no histórico** (não há origem de OS). O pedido do usuário em 08/11/2026 inclui OS, então no RDX ela entra como origem nova.

## O que fazer no RDX

- [ ] API: `GET /api/clientes/{id}/historico?page=N` junta, ordenado por data (mais recente primeiro):
  - anotações de `HistoricoCliente`;
  - orçamentos do cliente (T202), com o texto "ORÇAMENTO Nº000826": número com 6 dígitos e status Novo/Pedido/Cancelado/Concluído;
  - pedidos (T203), com o texto "PEDIDO Nº000836";
  - ordens de serviço (T204), com o texto "OS Nº…" — extra do RDX.
- [ ] Linhas automáticas: só leitura, com ID virtual (como o negativo da MarketUP) e o campo `origem` (orcamento/pedido/os) + `chave` (número do documento).
- [ ] Tela: a aba Histórico continua com a inclusão de anotação em cima. Na lista, as linhas automáticas mostram Data · Descrição · Status · lupa (abre `/vendas/orcamentos/{n}`, `/vendas/pedidos/{n}`, `/servicos/os/{n}`), sem lápis nem lixeira. "Ver mais registros" pagina como na MarketUP.
- [ ] O status mostrado é o atual do documento (muda sozinho quando o orçamento vira pedido, é cancelado etc.).
- [ ] Migração: as anotações manuais vêm da base completa (M002); as linhas automáticas aparecem sozinhas quando orçamentos, pedidos e OS forem carregados.
- [ ] Testes: cliente com anotação + orçamento + pedido + OS → ordem por data, textos, status e links.

## Dúvidas

- Confirmar com o usuário se a OS deve mesmo aparecer no histórico (na MarketUP não aparece).
