# T206 — Histórico do cliente com orçamentos e pedidos

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T102, T202, T203 |
| Skills | `criar-api-modulo`, `criar-tela-formulario` |
| Contexto | `context/marketup/telas-e-entidades.md` (Cliente › Histórico) |

## Objetivo

A aba **Histórico** da ficha do cliente mostra, junto com as anotações digitadas, uma linha para cada orçamento e pedido do cliente, com a situação atual e a lupa que abre o documento, como na MarketUP.

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
- **A MarketUP não põe a ordem de serviço no histórico** (não há origem de OS). Decisão do usuário em 08/11/2026: no RDX também **não** entra; se precisar, ele muda depois.

## O que fazer no RDX

- [x] API: `GET /api/clientes/{id}/historico?page=N` (`backend/apps/clientes/historico.py`), ordenado por data (mais recente primeiro), páginas de 5:
  - anotações de `HistoricoCliente`;
  - orçamentos do cliente (T202), com o texto "ORÇAMENTO Nº000826": número com 6 dígitos e status Novo/Pedido/Cancelado/Concluído;
  - pedidos (T203), com o texto "PEDIDO Nº000836";
- [x] Linhas automáticas: só leitura, com ID virtual (como o negativo da MarketUP) e o campo `origem` (orcamento/pedido/os) + `chave` (número do documento).
- [x] Tela: a aba Histórico continua com a inclusão de anotação em cima. Na lista, as linhas automáticas mostram Data · Descrição · Status · lupa (abre `/vendas/orcamentos/{n}` ou `/vendas/pedidos/{n}`), sem lápis nem lixeira. "Ver mais registros" pagina como na MarketUP.
- [x] O status mostrado é o atual do documento (muda sozinho quando o orçamento vira pedido, é cancelado etc.).
- [ ] Migração: as anotações manuais vêm da base completa (M002); as linhas automáticas aparecem sozinhas quando orçamentos e pedidos forem carregados.
- [x] Testes (`tests/test_historico_cliente.py`): cliente com anotação + orçamento + pedido → ordem por data, textos, status e links; OS não aparece.

## Dúvidas

- Nenhuma por enquanto (OS fora do histórico, decidido em 08/11/2026).

## Feito em 08/11/2026

- Reconferido na MarketUP (clientes 786 e 3141, só leitura): pedido aparece com o rótulo da listagem (FATURADO enquanto falta entregar ou receber, CONCLUÍDO quando entregue e pago); orçamento com o status dele; página de 5; "Ver mais registros" fica cinza quando não há mais (`TotalItems < PageSize`); lupa só nas linhas automáticas (ID −1); anotações com lápis e lixeira, gravadas com o Salvar da ficha.
- RDX: as anotações continuam no campo `historico` da ficha; a API devolve só as linhas automáticas e a tela junta as duas, por data. `AbaLista` ganhou `somenteLeitura` e `chave` para linhas sem lápis/lixeira.
- Diferença conhecida: as anotações vêm todas de uma vez (já vinham com a ficha); só orçamentos e pedidos são paginados. Na MarketUP a página de 5 junta os dois.
- [x] Conferência do usuário no navegador (08/11/2026).
