---
nome: mapear-entidade-marketup
descricao: Cria o mapeamento campo a campo de uma entidade da MarketUP para a tabela do RDX, mantendo o ID.
entradas: nome da entidade MarketUP (ex.: PersonClient) e uma exportação de exemplo
saidas: tabela de mapeamento em context/marketup/campos/<entidade>.md
---
# Mapear entidade da MarketUP

## Passo a passo

1. Leia `context/regras-de-negocio/ids-marketup.md` e `context/03-modelo-de-dados.md`.
2. Liste **todas** as colunas da exportação da MarketUP, sem pular nenhuma.
3. Para cada coluna, preencha uma linha:

   | Campo MarketUP | Coluna RDX | Tipo | Transformação | Decisão |
   | --- | --- | --- | --- | --- |
   | `ClientID` | `id` | BIGINT | nenhuma | chave = ID MarketUP |
   | `OfficialName` | `nome` | texto | `normalizar-nomes` | manter |
   | `OfflineID` | — | — | — | descartar: só usado pelo PDV |

4. Cada campo descartado tem o motivo escrito.
5. Valor `0` em campo de referência vira nulo (marque "a confirmar" se não tiver certeza).
6. Na dúvida sobre nome ou formato de um campo, siga a MarketUP.

## Verificação

- Número de linhas da tabela = número de colunas da exportação.
- A chave primária é o ID da MarketUP.
- Campos de nome e endereço citam `normalizar-nomes`.
