# M003 — Importadores e cargas

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | M001, M002, T102, T103 |
| Skills | `validar-migracao`, `normalizar-nomes` |
| Contexto | `context/regras-de-negocio/ids-marketup.md` |

## Objetivo

Scripts de importação por entidade, na ordem das dependências, gravando o ID explícito.

## Critérios de aceite

- Cada carga validada com a skill validar-migracao
- Log com o valor original dos nomes de pessoas padronizados (empresa e endereço entram como vieram)
- Sequências ajustadas para MAX(id) + 1

## Checklist

- [ ] Tabelas auxiliares
- [ ] Cadastros
  - [x] Clientes (`python manage.py importar_clientes /migracao/dados/ListaClientes.xlsx [--simular]`)
  - [x] Unidades, categorias, subcategorias e produtos (`importar_produtos ProdutosMarketUP.json Produtos.xlsx`)
  - [x] Serviços (`importar_servicos ServicosMarketUP.json`)
  - [x] Tipos de pagamento e condições (`importar_pagamentos PagamentosMarketUP.json`): lidos da lista que a ficha do orçamento da MarketUP carrega para "Forma de pagamento" / "Parcelamento" (`controller.paymentTypeList`). A tela de Tipo de pagamento traz os tipos, mas sem as condições.
  - [ ] Funcionários (a exportação não tem ID: depende da M002)

**Como os IDs do catálogo foram obtidos (08/11/2026):** a listagem da MarketUP (Catálogo › Produtos e Serviços) carrega na página o registro completo de cada item, com `ItemID` / `ServiceID`, categoria e subcategoria. Clicando "Ver mais registros" até o fim, esses dados foram salvos em `ProdutosMarketUP.json` e `ServicosMarketUP.json`. A unidade vem da exportação `Produtos.xlsx`, casando pelo código de barras (190 de 190). Unidades com os IDs da tela Unidades de Medida: 1 UN, 2 CX, 3 FD, 4 KG, 5 HF, 6 M², 7 M, 8 ML, 9 CT, 10 BR. Produtos e serviços usam a mesma numeração de item (os serviços 28, 35 e 77 não coincidem com nenhum produto).

## Cargas realizadas

| Data | Carga | Resultado |
| --- | --- | --- |
| 08/11/2026 | Pagamentos | 21 tipos (PaymentTypeID 1 a 21) e 56 condições com os IDs da MarketUP. Vencimentos conferidos com os nomes (ex.: "SEM ENTRADA + 03x" = 30/60/90 dias; cheque "30 e 90 Dias"). Recarga testada. |
| 08/11/2026 | Catálogo | 10 unidades, 4 categorias, 10 subcategorias, 190 produtos (IDs até 193, próximo 194; 18 kits sem composição; 185 sem NCM, como na MarketUP) e 3 serviços (28, 35, 77). Conferência OK; recarga testada. |
| 08/11/2026 | Clientes (`ListaClientes.xlsx`) | 3.210 clientes (58 PJ), IDs 6 a 3295, próximo ID 3296; 3.162 endereços (2 sem código IBGE); 555 nomes de PF padronizados (amostra de 20 conferida); 13 telefones incompletos (avisos no log). Conferência OK. Recarga testada: atualiza sem duplicar. |

Os logs ficam em `backend/logs/migracao/` (fora do git: têm dados pessoais). A pasta `migracao/dados/` entra no contêiner só para leitura em `/migracao/dados`.
- [ ] Histórico comercial
- [ ] Comissões e financeiro
- [ ] Estoque
- [ ] XMLs de notas

## Dúvidas

- ~~"de sa" virava "de SA"~~ — resolvido em 08/11/2026: o usuário decidiu que "SA" sai da lista de siglas (fica "Sa"; "S.A." e "S/A" continuam). Clientes recarregados.
