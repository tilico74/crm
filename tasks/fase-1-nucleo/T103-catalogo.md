# T103 — Catálogo

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T101, M001 |
| Skills | `criar-api-modulo`, `mapear-entidade-marketup`, `criar-tela-listagem`, `criar-tela-formulario` |
| Contexto | `context/03-modelo-de-dados.md` |

## Objetivo

Produtos, serviços (tabelas separadas), categorias, subcategorias, marcas e unidades, com IDs da MarketUP.

## Critérios de aceite

- Produto e serviço com sequências próprias
- Dados fiscais (NCM, Origem, CEST) no produto, como na MarketUP
- Descrição de produto não é normalizada

## Checklist

- [ ] Modelos e API
- [ ] Telas
- [ ] Testes

## Dúvidas

- [x] Variações (cor, acabamento) são produtos separados na MarketUP. Migrar 1 para 1, mantendo os IDs (recomendado), ou agrupar em grade depois da virada?
  - **Decidido (07/11/2026):** migrar 1 para 1, mantendo os IDs.
- [x] Corrigir na MarketUP, antes da migração, os dados inconsistentes ("Natura"/"Natural", marca "Sportnet"/"SportNet", subcategorias trocadas, itens sem categoria)? Ou corrigir no RDX depois da carga?
  - **Decidido (07/11/2026):** corrigir na MarketUP antes da carga, para os dados chegarem limpos.
- [ ] Quantos produtos estão sem NCM? Sem NCM não se emite NF-e de produto (afeta a T401).
- [ ] Combos, etiquetas e produção entram na v1?

Levantamento das telas: `context/marketup/telas-e-entidades.md`.
