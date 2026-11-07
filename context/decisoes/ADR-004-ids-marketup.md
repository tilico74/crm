# ADR-004: IDs iguais aos da MarketUP

- **Status:** Aceito em 07/11/2026.

## Decisão

A chave primária de cada registro migrado é o mesmo inteiro da MarketUP. Detalhes em `../regras-de-negocio/ids-marketup.md`.

## Por quê

- Evita problemas futuros de migração e de conferência.
- O usuário continua vendo os mesmos números (ex.: orçamento 3874).

## Consequência

Até a virada, só a MarketUP cria registros; o RDX é espelho.
