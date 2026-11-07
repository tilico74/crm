---
nome: criar-tela-listagem
descricao: Monta a listagem de um módulo no modelo MarketUP com o Design System RDX.
entradas: módulo, colunas a exibir, status possíveis
saidas: tela de listagem responsiva
---
# Criar tela de listagem

Referência: `context/design-system/layout-e-telas.md`, `mobile-tablet.md` e o componente ListPage do Design System RDX.

## Passo a passo

1. Abra a listagem equivalente na MarketUP (só leitura) e anote as colunas, a ordem e os filtros. **Na dúvida, siga a MarketUP.**
2. Use a coluna fixa de 992px.
3. Faixa de topo: nome do módulo (`eyebrow`), título (`page-title`) e linha de 1px.
4. Barra de ferramentas:
   - busca "Localizar por";
   - "Adicionar filtro";
   - blocos de visualizar, imprimir e exportar;
   - "Adicionar novo" à direita.
   - **Nada de anúncio.**
5. Tabela:
   - cabeçalho de 72px;
   - linhas de 110px;
   - faixa de status de 10px na cor do status;
   - número do registro (ID MarketUP) com 24px;
   - lápis de editar na última coluna.
6. Celular: as linhas viram cartões e o "Adicionar novo" fica fixo embaixo.

## Verificação

- [ ] As colunas e a ordem batem com a MarketUP.
- [ ] Status tem palavra e cor; a cor não é o único sinal.
- [ ] A skill `revisar-acessibilidade-mobile` passou.
