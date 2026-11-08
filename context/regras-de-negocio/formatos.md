# Formatos de documentos, contatos e valores

**Regra:** no banco e na API os valores ficam **limpos**. A máscara é só na tela (e em textos gerados, como PDFs).

| Dado | Na tela | No banco | Validação |
| --- | --- | --- | --- |
| CPF | `529.982.247-25` | `52998224725` | Dígitos verificadores |
| CNPJ (numérico) | `11.222.333/0001-81` | `11222333000181` | Dígitos verificadores |
| CNPJ (alfanumérico, Receita Federal a partir de 2026) | `12.ABC.345/01DE-35` | `12ABC34501DE35` | 12 letras/dígitos + 2 dígitos verificadores; cada caractere vale (código ASCII − 48) |
| CPF ou CNPJ no mesmo campo | escolhe pelo tamanho e pelas letras | limpo | conforme o tipo |
| RG | 9 caracteres: `12.345.678-X`; 8: `1.234.567-8`; 7 (SC): `1.234.567`; outros: como digitado | dígitos e `X` | Nenhuma (cada estado tem um formato) |
| CEP | `88138-152` | `88138152` | 8 dígitos |
| Telefone fixo | `(48) 3222-1234` | `4832221234` | 10 dígitos (DDD + número) |
| Celular | `(48) 99961-4233` | `48999614233` | 11 dígitos |
| Dinheiro | `R$ 1.234,56` | decimal com 2 casas | — |
| Percentual | `5,00%` | decimal com 2 casas | — |
| Data | `07/11/2026` | ISO `2026-11-07` | — |

Inscrição estadual e municipal: o formato muda por estado e município; ficam como digitados (sem máscara).

## Onde está o código

| Lado | Arquivo | O que tem |
| --- | --- | --- |
| Back-end | `backend/apps/core/documentos.py` | `cpf_valido`, `cnpj_valido`, `formatar_*`, os campos de serializador `CpfField`, `CnpjField`, `RgField`, `CepField`, `TelefoneField` (aceitam com ou sem máscara, gravam limpo, recusam inválido com mensagem) e os validadores de modelo `validar_cpf` e `validar_cnpj` (valem também no painel interno e nas importações) |
| Front-end | `frontend/src/lib/mascaras.ts` | `formatar(tipo, valor)`, `limpar`, `validar`, `formatarMoeda`, `formatarPercentual`, `formatarData` |
| Front-end | `frontend/src/components/form.tsx` → `MaskedField` | Campo que formata enquanto digita, entrega o valor limpo e valida ao sair |

Os testes das duas pontas usam os mesmos exemplos (`backend/tests/test_documentos.py`, `frontend/tests/mascaras.test.ts`).

Como usar nas telas: skill `skills/mascaras-e-formatos/SKILL.md`.
