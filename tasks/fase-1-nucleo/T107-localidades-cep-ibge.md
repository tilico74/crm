# T107 — Localidades: CEP (ViaCEP) e estados e municípios (IBGE)

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T003 |
| Skills | `preencher-endereco` |
| Contexto | `context/decisoes/ADR-006-localidades-cep-ibge.md`, `context/integracoes/localidades.md` |

## Objetivo

4 endpoints no back-end para os cadastros consumirem: endereço pelo CEP, CEPs pelo endereço, lista de estados e lista de municípios por estado.

## Critérios de aceite

- `GET /api/localidades/cep/{cep}`, `/api/localidades/enderecos`, `/api/localidades/estados`, `/api/localidades/estados/{uf}/municipios`
- Resposta com os nomes de campo do RDX, cache no Redis, erros em português
- Serviço fora do ar devolve 503 e não bloqueia o cadastro
- Testes sem depender da internet

## Checklist

- [x] Endpoints e cache (`backend/apps/core/localidades.py`, `backend/apps/core/urls.py`, `CACHES` em settings)
- [x] Testes (`backend/tests/test_localidades.py`)
- [x] Cliente no front-end (`frontend/src/lib/localidades.ts`)
- [x] Componente `CepField` (`frontend/src/components/CepField.tsx`): ao completar 8 dígitos preenche endereço, bairro, cidade, UF e IBGE; obrigatório em todo formulário (ADR-006, AGENTS.md); aplicado em Informações da empresa; testes em `frontend/tests/CepField.test.tsx`
- [x] Componentes `EnderecoField` (lupa acoplada) e `BuscaEnderecoModal` (UF, cidade, rua; lista a partir da 3ª letra): obrigatórios em todo formulário; aplicados em Informações da empresa; teste em `frontend/tests/EnderecoField.test.tsx`
- [x] ADR-006, `context/integracoes/localidades.md` e skill `preencher-endereco`

## Dúvidas

- Nenhuma por enquanto. O uso nas telas entra em cada cadastro (T102, T105 e próximos), seguindo a skill.
