# ADR-005: Padronização de nomes próprios e endereços

- **Status:** Aceito em 07/11/2026. **Substituído por ADR-007** em 08/11/2026: só nomes de pessoas são padronizados.

## Decisão

Nomes de pessoas, empresas e endereços são gravados com inicial maiúscula em cada palavra, exceto palavras de ligação (de, da, do, dos, das, e…). A regra é aplicada no back-end, antes de gravar, inclusive na importação da MarketUP.

## Por quê

Cadastros chegam em formatos misturados ("JOSÉ DA SILVA", "maria dos santos"). Um padrão único melhora busca, impressão de documentos e notas fiscais.

## Detalhes

- Regra: `../regras-de-negocio/padronizacao-de-nomes.md`.
- Procedimento e casos de teste: `../../skills/normalizar-nomes/SKILL.md`.
