# P001 — Grade de produtos (variações de cor, tamanho, acabamento)

| Campo | Valor |
| --- | --- |
| Status | A fazer (depois da virada) |
| Depende de | T103, T402 |
| Skills | `criar-api-modulo`, `criar-tela-formulario`, `mascaras-e-formatos` |
| Contexto | `context/marketup/telas-e-entidades.md` (Catálogo › Produtos), `context/regras-de-negocio/ids-marketup.md` |

## Objetivo

Reunir as variações de um mesmo produto (cor, tamanho, acabamento) num cadastro só, como o "Tipo de estoque: Grade" da MarketUP. Cada combinação tem código de barras e estoque próprios; descrição, categoria, fiscal e preço base são do produto.

Exemplo: "Batente alumínio Prime Kids" com as cores Anodizado, Branca, Natural e Preta — hoje são 4 produtos separados.

## Por que depois da virada

- A RDX não usa grade na MarketUP (190 produtos com estoque "Único"); cada cor é um produto.
- Juntar na migração faria variações perderem o ID da MarketUP (regra de IDs). Decisão de 08/11/2026: migrar 1 para 1 e implementar a grade depois.

## Critérios de aceite

- Produto com tipo de estoque "Grade": características (ex.: Cor, Altura) e a tabela de combinações, cada uma com código de barras, estoque e preço opcional próprio
- Produtos antigos (migrados) podem ser **ligados** a uma combinação da grade sem perder o ID nem o histórico de orçamentos e pedidos
- Orçamento e pedido: escolher o produto e depois a variação
- Alterar preço, NCM ou categoria do produto vale para todas as variações

## Checklist

- [ ] Modelo (características, valores, combinações) e API
- [ ] Ficha do produto: aba Grade
- [ ] Ligação das variações com os produtos migrados
- [ ] Orçamento e pedido com escolha da variação
- [ ] Testes

## Dúvidas

- [ ] Quais características a RDX quer (cor, altura da tela, acabamento…)?
- [ ] O preço muda por variação ou é sempre o mesmo?
