# T203 — Pedidos

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T202 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario` |
| Contexto | `context/03-modelo-de-dados.md` |

## Objetivo

Pedidos de venda com itens, pagamento e status; ID = SaleOrderID. Gera OS, título e comissão.

## Critérios de aceite

- Pedido nasce do orçamento ou direto
- Gera os documentos derivados

## Checklist

- [ ] Modelo e API
- [ ] Telas
- [ ] Aparecer no Histórico do cliente (tarefa T206: origem, número e status atual, lupa abrindo o documento)
- [ ] Impressão / PDF do pedido no **mesmo modelo da impressão do orçamento** (aprovado pelo usuário em 08/11/2026; ver `frontend/src/resources/orcamentos/OrcamentoImpressao.tsx` e a T202):
  - topo da MarketUP: logotipo à esquerda, dados da empresa à direita;
  - seção "Pedido de venda" no lugar de "Orçamento de venda" (número, cliente, documento, e-mail, telefone e datas);
  - endereço de cobrança e de entrega lado a lado;
  - itens com Referência, Descrição, Unid., Qtd., Unitário, Desconto e Total; "OBS:" de cada item; caixa "Quantidade de itens / Valor total dos itens";
  - valor total, forma/condições de pagamento, Observações (sempre, mesmo vazia), assinaturas do comprador e do recebedor e "Impresso em";
  - folha A4 inteira: os itens empurram o fecho para o pé da página e passam para a página seguinte quando não cabem.
  - De preferência, extrair as partes comuns (seções, endereços, itens, fecho) do `OrcamentoImpressao` para um componente de impressão de documento de venda, usado pelos dois.

## Dúvidas

- Nenhuma por enquanto.
