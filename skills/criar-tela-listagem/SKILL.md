---
nome: criar-tela-listagem
descricao: Monta a listagem de um módulo no modelo MarketUP com o Design System RDX.
entradas: módulo, colunas a exibir, status possíveis
saidas: tela de listagem responsiva
---
# Criar tela de listagem

Referência: `context/design-system/layout-e-telas.md` e `mobile-tablet.md`. Modelo pronto para copiar: `frontend/src/resources/funcionarios/FuncionariosList.tsx`.

## Componentes prontos (use, não recrie)

| Peça | Arquivo | Para quê |
| --- | --- | --- |
| `PageHeader` | `frontend/src/components/PageHeader.tsx` | Faixa de topo: módulo, título, "ocultar" e a barra de ferramentas como filho |
| `ListToolbar` | `frontend/src/components/ListToolbar.tsx` | "Localizar por" (`onSearch`, com espera de 300 ms), filtros, blocos e "Adicionar novo" (`onAdd`; sem `onAdd` o botão some) |
| `DataTable` | `frontend/src/components/DataTable.tsx` | Tabela da MarketUP: `columns`, `rows`, `onEdit`, `onDelete`, `canDelete`, "Ver mais registros" (`onMore`), cartões no celular |
| `TabelaEditavel` | `frontend/src/components/TabelaEditavel.tsx` | Listas simples com **edição na própria linha** (Unidades, Marcas, subcategorias): `colunas` com `exibir`/`editar`, `nova`, `onSalvar`, `onExcluir`, `podeEditar`/`podeExcluir`, `acoesExtras`; "Adicionar novo" chama `ref.adicionar()`. Enter confirma, Esc cancela. Modelos: `frontend/src/resources/catalogo/UnidadesList.tsx` e `CategoriaForm.tsx` |
| `ConfirmDialog` | `frontend/src/components/ConfirmDialog.tsx` | Confirmação antes de excluir (o foco começa em Cancelar) |
| `useMe` | `frontend/src/app/useMe.ts` | `pode(rota, "adicionar" | "alterar" | "excluir")`: esconda o botão que a pessoa não pode usar |
| `useList` (Refine) | `frontend/src/app/providers.ts` | Dados da API Django: `pagination.pageSize` cresce no "Ver mais"; busca vai como `filters: [{ field: "q", ... }]`; parâmetros extras em `meta.params` |
| `formatar*` | `frontend/src/lib/mascaras.ts` | CPF, CNPJ, telefone, CEP, R$, % e datas nas colunas (skill `mascaras-e-formatos`) |

Rota nova: registre em `frontend/src/App.tsx` e ligue a rota à funcionalidade em `FUNCIONALIDADE_POR_ROTA` (`frontend/src/app/menu.ts`); o menu e o acesso seguem as permissões sozinhos.

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
   - lápis de editar na última coluna;
   - CPF, CNPJ, telefone, dinheiro e data formatados com a skill `mascaras-e-formatos`.
6. Celular: as linhas viram cartões e o "Adicionar novo" fica fixo embaixo.

## Verificação

- [ ] As colunas e a ordem batem com a MarketUP.
- [ ] Status tem palavra e cor; a cor não é o único sinal.
- [ ] A skill `revisar-acessibilidade-mobile` passou.
