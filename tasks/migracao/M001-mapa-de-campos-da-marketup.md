# M001 — Mapa de campos da MarketUP

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T001 |
| Skills | `mapear-entidade-marketup` |
| Contexto | `context/marketup/mapa-api.md` |

## Objetivo

Mapear campo a campo cada entidade da MarketUP, a partir das exportações oficiais.

## Critérios de aceite

- Um arquivo por entidade em context/marketup/campos/
- Toda coluna exportada tem destino ou motivo de descarte

## Checklist

- [ ] Clientes (52 campos)
- [ ] Produtos (112 campos)
- [ ] Serviços
- [ ] Orçamentos
- [ ] Pedidos
- [ ] Comissões
- [ ] OS
- [ ] Financeiro
- [ ] Notas

## Dúvidas

- [x] A exportação de Funcionários da tela não traz o EmployeeID (ver `context/marketup/telas-e-entidades.md`). Verificar se as outras exportações (Clientes, Produtos) trazem o ID; se não, a migração depende da base completa (M002).
  - **Conferido em 08/11/2026:** Produtos e Serviços também não trazem o ID (ItemID, ServiceID). A migração depende da base completa (M002). Alternativa, se a MarketUP não entregar: as telas mostram o ID (coluna ID em Marcas e Unidades; endereço `item/detail/{id}` nos produtos), daria para montar a tabela ID × código de barras lendo as telas, com autorização do contrato.
