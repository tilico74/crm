# T104 — Normalização de nomes

| Campo | Valor |
| --- | --- |
| Status | Em andamento |
| Depende de | T003, T004 |
| Skills | `normalizar-nomes` |
| Contexto | `context/regras-de-negocio/padronizacao-de-nomes.md`, `context/decisoes/ADR-005-padronizacao-nomes.md` |

## Objetivo

Implementar a função de normalização no back-end (gravação) e no front-end (prévia), usando o mesmo casos.json.

## Critérios de aceite

- [x] Back-end e front-end passam nos 25 casos de skills/normalizar-nomes/casos.json
- [x] Idempotente
- [ ] Lista de siglas editável pelo administrador
- [ ] Aplicada em todos os campos listados na regra

## Checklist

- [x] Função no back-end: `normalizar_nome` em `backend/apps/core/normalizacao.py`
- [x] Função no front-end: `normalizarNome` em `frontend/src/lib/normalizarNome.ts`
- [x] Testes lendo casos.json: `backend/tests/test_normalizacao.py` e `frontend/tests/normalizarNome.test.ts`. O arquivo é montado só para leitura em `/casos/normalizar-nomes.json` nos serviços `backend` e `frontend` (`docker-compose.yml`), sem cópia. Os testes também conferem que as listas do código são iguais às do casos.json.
- [ ] Tela para editar siglas

## Notas

- A regra é uma só para nomes de pessoas, empresas e endereços; por isso não há função separada para endereço.
- As duas funções aceitam a lista de siglas como parâmetro opcional (padrão: a do casos.json), para quando a lista editável existir.

## Dúvidas

- [ ] Corrigir acentos automaticamente? Hoje a regra não corrige ("Protecao" fica sem acento).
- [ ] Onde fica a lista de siglas editável pelo administrador? A regra diz que ela fica em `casos.json` (chave `siglas`), mas o administrador não edita arquivo do repositório. Precisa de tabela no banco (com qual nome de tabela/colunas, conforme `context/03-modelo-de-dados.md`?) e de tela em qual menu? E as siglas cadastradas pelo administrador entram nos casos de teste ou só a lista inicial?
- [ ] "Aplicada em todos os campos listados na regra": esses campos (cliente, contato, vendedor, técnico, endereço…) ainda não existem; dependem de T101, T102 e seguintes. Esse critério fica para cada tarefa que criar os campos, ou T104 só fecha quando todos existirem?
- [ ] A regra lista romanos só até X; o casos.json vai até XX (XI–XV, XX). O código segue o casos.json. Confirmar.
- [ ] Palavra que começa com número e tem letra (ex.: "7a", "2º"): o passo a passo diz "primeira letra maiúscula"; o código põe em maiúscula o primeiro caractere, então "7a" fica "7a". Confirmar se o esperado não seria "7A".
