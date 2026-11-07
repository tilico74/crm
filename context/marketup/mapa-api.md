# MarketUP: mapa da API (somente referência)

Levantado em 07/11/2026, só por leitura. **Não automatize chamadas à API interna** sem autorização do contrato; a migração usa exportações oficiais.

- Back-end deles: ASP.NET Core (Kestrel), Google Cloud, AWS S3.
- Padrão: `POST https://api-erp.marketup.com/v1/{Entidade}/{Ação}`, com as ações `GetPagedList`, `List`, `GetListBaseData` e `Get`.

| Módulo | Endpoints |
| --- | --- |
| Catálogo | `CatalogItem`, `CatalogService`, `Category`, `Brand`, `ItemUnit` |
| Clientes | `PersonClient`, `ClientType` |
| CRM | `CRM/List` |
| Vendas | `SaleBudget`, `SaleOrder` |
| Comissões | `SellerCommission` |
| Serviços | `WorkOrder` |
| Estoque | `StockQuery`, `StockLocation` |
| Fiscal | `NewInvoice` |
| Financeiro | `FinancialCashFlow`, `FinancialAccount`, `FinancialManagementAccount`, `Bank`, `PaymentType`, `CompanyPartner` |

Campos observados: cliente tem 52, produto tem 112. A lista completa é levantada na tarefa M001.
