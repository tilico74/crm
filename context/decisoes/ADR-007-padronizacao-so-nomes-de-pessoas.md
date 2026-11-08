# ADR-007: Padronização só em nomes de pessoas

- **Status:** Aceito em 08/11/2026. Substitui o ADR-005.

## Contexto

O ADR-005 padronizava nomes de pessoas, empresas e endereços ao gravar. Em empresas e endereços a regra tinha casos difíceis: marcas como "McDonald's" e "iFood" ficavam erradas, siglas dependiam de uma lista que o administrador precisaria editar, e a correção automática de acentos exigia listas de exceções (ex.: "Moraes"). A MarketUP grava como foi digitado.

## Decisão

- **Nomes de pessoas** continuam padronizados: inicial maiúscula em cada palavra, palavras de ligação (da, dos, e…) minúsculas. Acentos não são corrigidos.
- **Razão social, nome fantasia e endereços** são gravados como foram digitados ou importados, igual à MarketUP.

## Consequências

- `normalizar_nome` (back-end) e `normalizarNome` (front-end) continuam, mas só são chamadas em campos de nome de pessoa. Hoje: `nome` e `apelido` do funcionário.
- Empresa (razão social, nome fantasia e endereços) e razão social e nome fantasia do funcionário deixaram de ser padronizados.
- A correção automática de acentos foi descartada.
- A lista de siglas editável pelo administrador deixa de ser necessária.
- Registros já gravados com a padronização ficam como estão.
- Regra: `../regras-de-negocio/padronizacao-de-nomes.md`.
