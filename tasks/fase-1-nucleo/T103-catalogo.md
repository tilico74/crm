# T103 — Catálogo

| Campo | Valor |
| --- | --- |
| Status | Em andamento |
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
- [x] Quantos produtos estão sem NCM? Sem NCM não se emite NF-e de produto (afeta a T401).
  - **185 de 190 estão sem NCM** (exportação de 08/11/2026). Corrigir na MarketUP antes da carga, junto com os outros dados inconsistentes.
- [ ] Combos, etiquetas e produção entram na v1?

Levantamento das telas: `context/marketup/telas-e-entidades.md`.

## Andamento

- **Parte 1 — tabelas auxiliares (pronta em 08/11/2026):** Unidades (5 do sistema com os IDs da MarketUP, travadas), Marcas (com imagem), Categorias com Subcategorias (os IDs das subcategorias não mudam ao editar). Back-end em `backend/apps/catalogo/`, telas em `frontend/src/resources/catalogo/`, testes em `backend/tests/test_catalogo.py`. Componente novo reutilizável: `TabelaEditavel`.
- **Parte 2 — Produtos e Serviços:** a fazer. Campos da exportação já levantados em `context/marketup/telas-e-entidades.md`.
