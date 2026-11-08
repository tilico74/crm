# T108 — Máscaras e formatos (CPF, CNPJ, RG, CEP, telefone, R$, datas)

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T003, T004 |
| Skills | `mascaras-e-formatos` |
| Contexto | `context/regras-de-negocio/formatos.md` |

## Objetivo

Um lugar só, reutilizável, para máscaras de campos e formatos de exibição, no front-end e no back-end.

## Critérios de aceite

- CPF, CNPJ (numérico e alfanumérico), CPF/CNPJ no mesmo campo, RG, CEP, telefone fixo e celular com máscara ao digitar e ao exibir
- Banco e API com valores limpos; CPF e CNPJ validados pelos dígitos verificadores nas duas pontas
- Dinheiro, percentual e data no formato brasileiro
- Aplicado onde já existe: ficha e lista de funcionários, informações da empresa (com busca de CEP)

## Checklist

- [x] `backend/apps/core/documentos.py` + testes
- [x] `frontend/src/lib/mascaras.ts` + `MaskedField` + testes
- [x] Aplicado em Funcionários e Informações da empresa
- [x] Regra, skill e índices

## Dúvidas

- Nenhuma por enquanto. Inscrição estadual e municipal ficam sem máscara (variam por estado e município).
