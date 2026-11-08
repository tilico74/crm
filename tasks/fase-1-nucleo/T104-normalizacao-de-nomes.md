# T104 — Normalização de nomes

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T003, T004 |
| Skills | `normalizar-nomes` |
| Contexto | `context/regras-de-negocio/padronizacao-de-nomes.md`, `context/decisoes/ADR-007-padronizacao-so-nomes-de-pessoas.md` |

## Objetivo

Implementar a função de normalização no back-end (gravação) e no front-end (prévia), usando o mesmo casos.json.

## Critérios de aceite

- [x] Back-end e front-end passam nos 28 casos de skills/normalizar-nomes/casos.json
- [x] Idempotente
- [x] Aplicada nos campos de nome de pessoa que já existem (funcionário); cada tarefa nova aplica nos seus (T102: cliente pessoa física e contato)

## Checklist

- [x] Função no back-end: `normalizar_nome` em `backend/apps/core/normalizacao.py`
- [x] Função no front-end: `normalizarNome` em `frontend/src/lib/normalizarNome.ts`
- [x] Testes lendo casos.json: `backend/tests/test_normalizacao.py` e `frontend/tests/normalizarNome.test.ts`. O arquivo é montado só para leitura em `/casos/normalizar-nomes.json` nos serviços `backend` e `frontend` (`docker-compose.yml`), sem cópia. Os testes também conferem que as listas do código são iguais às do casos.json.
- [x] Aplicada só a nomes de pessoas (ADR-007): `nome` e `apelido` do funcionário. Empresa e endereços deixaram de ser padronizados.

## Notas

- Desde o ADR-007 (08/11/2026) a regra vale só para nomes de pessoas. A função continua genérica (siglas, rodovias), mas só é chamada em campos de nome de pessoa.

## Dúvidas

- [x] Corrigir acentos automaticamente? **Não** (08/11/2026). Chegou a ser implementado e foi descartado junto com o ADR-007.
- [x] Onde fica a lista de siglas editável pelo administrador? A regra diz que ela fica em `casos.json` (chave `siglas`), mas o administrador não edita arquivo do repositório. Precisa de tabela no banco (com qual nome de tabela/colunas, conforme `context/03-modelo-de-dados.md`?) e de tela em qual menu? E as siglas cadastradas pelo administrador entram nos casos de teste ou só a lista inicial? **Não se aplica mais** (ADR-007): siglas eram para nomes de empresas, que agora ficam como digitados.
- [x] "Aplicada em todos os campos listados na regra": esses campos (cliente, contato, vendedor, técnico, endereço…) ainda não existem; dependem de T101, T102 e seguintes. Esse critério fica para cada tarefa que criar os campos, ou T104 só fecha quando todos existirem? **Cada tarefa aplica nos seus campos** (08/11/2026); T104 fechada.
- [x] A regra lista romanos só até X; o casos.json vai até XX (XI–XV, XX). O código segue o casos.json. Confirmar. **Romanos de I a XX** (08/11/2026); a lista foi completada com XVI–XIX, que faltavam.
- [x] Palavra que começa com número e tem letra (ex.: "7a", "2º"): o passo a passo diz "primeira letra maiúscula"; o código põe em maiúscula o primeiro caractere, então "7a" fica "7a". Confirmar se o esperado não seria "7A". **Sim, "7A"** (08/11/2026); "2º" continua "2º".
