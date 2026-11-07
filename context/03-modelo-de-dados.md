# Modelo de dados

O pedido é a entidade central: dele nascem a ordem de serviço, a nota fiscal, o título a receber e a comissão.

| Tabela | Chave = ID da MarketUP | Referências principais |
| --- | --- | --- |
| `cliente` | `ClientID` | `lista_preco_id` |
| `lista_preco` | `ClientTypeID` | — |
| `produto` | `ItemID` | `categoria_id`, `subcategoria_id`, `marca_id`, `unidade_id` |
| `servico` | `ServiceID` (sequência própria) | `unidade_id` |
| `categoria` / `subcategoria` | `CategoryID` / `SubcategoryID` | — |
| `marca` / `unidade` | `BrandID` / `ItemUnitID` | — |
| `vendedor` | `EmployeeID` | `usuario_id` |
| `orcamento` | `SaleBudgetID` (= número na tela) | `cliente_id`, `vendedor_id` |
| `pedido` | `SaleOrderID` | `orcamento_id`, `cliente_id`, `vendedor_id` |
| `comissao` | `SellerCommissionID` | `vendedor_id`, `pedido_id`, `fechamento_id` |
| `comissao_fechamento` | `SellerCommissionClosingID` | `vendedor_id` |
| `crm_acao` | `LastActionID` | `cliente_id` |
| `ordem_servico` | a confirmar (`WorkOrderID`) | `pedido_id`, `cliente_id` |
| `nota_fiscal` | a confirmar | `pedido_id` |

Toda tabela tem `id` (BIGINT, igual à MarketUP), `criado_em`, `atualizado_em` e `criado_por`. Produto e serviço ficam em tabelas separadas porque as sequências da MarketUP se repetem entre eles.

Mapa completo de campos: tarefa `tasks/migracao/M001-mapa-de-campos.md`.
