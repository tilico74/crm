# IDs da MarketUP

1. A chave primária de cada tabela é o **mesmo inteiro da MarketUP** (BIGINT). Sem UUID e sem numeração nova.
2. Importação grava o ID explícito. Ao fim de cada carga, as sequências do PostgreSQL vão para `MAX(id) + 1` (`manage.py sqlsequencereset`).
3. Até a virada, **só a MarketUP cria registros**. O RDX é espelho, atualizado por cargas. Isso evita dois registros diferentes com o mesmo ID.
4. Chaves estrangeiras mantêm o valor: `ClientID` vira `cliente_id` com o mesmo número.
5. O valor `0` em campos de referência é tratado como nulo (a confirmar nas exportações).
6. Códigos em texto (`BarCode`, `InternalCode`, `IntegrationCode`, `PickingOrderId`) são copiados sem alteração.

Tabela completa de chaves: `03-modelo-de-dados.md`.
