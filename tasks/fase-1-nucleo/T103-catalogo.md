# T103 — Catálogo

| Campo | Valor |
| --- | --- |
| Status | Concluída |
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

- [x] Modelos e API
- [x] Telas
- [x] Testes

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
- **Parte 2 — Produtos e Serviços (pronta em 08/11/2026):** ficha do produto no modelo da MarketUP (código de barras, foto, Ativo/Inativo; dados; preços com a margem calculada; abas Estoque, Fiscal e Composição dos kits) e ficha do serviço. NCM e CEST com máscara e validação; código de barras não se repete; subcategoria precisa ser da categoria; item de kit não pode ser excluído. Lista de produtos com o selo "Sem NCM" e o filtro "só sem NCM" para a limpeza fiscal.
- **Fragmentação (08/11/2026):** aba no produto, como na MarketUP: "1 <unidade do produto> = <quantidade> <unidade>" e o valor de venda de cada parte (ex.: 1 Rolo = 50 Metros a R$ 12,00). Tudo ou nada: os três campos juntos ou nenhum; "Não fracionar" limpa. O "estoque de consumo" entra com a T301.
- **Fora desta tarefa:** Grade (decidido implementar depois da virada: `tasks/pos-virada/P001-grade-de-produtos.md`), PDV e Loja virtual (fora do escopo), Combos e Etiquetas (dúvida em aberto).
