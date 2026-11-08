# tasks — o que fazer

Uma tarefa por arquivo, agrupadas por fase. A base tecnológica foi instalada nas tarefas T002–T004.

## Como um agente trabalha uma tarefa

1. Escolha a primeira tarefa "A fazer" cujas dependências estão "Concluída".
2. Leia o contexto e as skills citados no cabeçalho.
3. Mude o status para "Em andamento".
4. Faça só o escopo da tarefa.
5. Marque o checklist.
6. Confira os critérios de aceite.
7. Mude o status para "Concluída".
8. Dúvida sem resposta em `context/`: escreva em "Dúvidas" e pare.

**Status possíveis:** A fazer · Em andamento · Bloqueada · Concluída.

## Painel

| ID | Tarefa | Status | Depende de |
| --- | --- | --- | --- |
| T001 | [Estrutura do repositório para IA](fase-0-fundacao/T001-estrutura-do-repositorio-para-ia.md) | Concluída | — |
| T002 | [Docker Compose do projeto](fase-0-fundacao/T002-docker-compose-do-projeto.md) | Concluída | T001 |
| T003 | [Esqueleto do back-end](fase-0-fundacao/T003-esqueleto-do-back-end.md) | Concluída | T002 |
| T004 | [Esqueleto do front-end](fase-0-fundacao/T004-esqueleto-do-front-end.md) | Concluída | T002 |
| T005 | [Qualidade e integração contínua](fase-0-fundacao/T005-qualidade-e-integracao-continua.md) | A fazer | T003, T004 |
| T101 | [Usuários e permissões](fase-1-nucleo/T101-usuarios-e-permissoes.md) | Concluída | T003, T004 |
| T102 | [Clientes](fase-1-nucleo/T102-clientes.md) | A fazer | T101, T104, M001 |
| T103 | [Catálogo](fase-1-nucleo/T103-catalogo.md) | Concluída | T101, M001 |
| T104 | [Normalização de nomes](fase-1-nucleo/T104-normalizacao-de-nomes.md) | Concluída | T003, T004 |
| T105 | [Ajustes › Empresa](fase-1-nucleo/T105-ajustes-empresa.md) | Concluída | T101, T104 |
| T106 | [Ajustes › Financeiro](fase-1-nucleo/T106-ajustes-financeiro.md) | Concluída | T101 |
| T107 | [Localidades: CEP e IBGE](fase-1-nucleo/T107-localidades-cep-ibge.md) | Concluída | T003 |
| T108 | [Máscaras e formatos](fase-1-nucleo/T108-mascaras-e-formatos.md) | Concluída | T003, T004 |
| T201 | [CRM](fase-2-comercial/T201-crm.md) | A fazer | T102 |
| T202 | [Orçamentos](fase-2-comercial/T202-orcamentos.md) | A fazer | T102, T103 |
| T203 | [Pedidos](fase-2-comercial/T203-pedidos.md) | A fazer | T202 |
| T204 | [Ordens de serviço](fase-2-comercial/T204-ordens-de-servico.md) | A fazer | T203 |
| T205 | [Comissões](fase-2-comercial/T205-comissoes.md) | A fazer | T203 |
| T301 | [Estoque](fase-3-operacao/T301-estoque.md) | A fazer | T103 |
| T302 | [Financeiro](fase-3-operacao/T302-financeiro.md) | A fazer | T203 |
| T401 | [Notas fiscais](fase-4-fiscal-e-virada/T401-notas-fiscais.md) | A fazer | T203 |
| T402 | [Período em paralelo e virada](fase-4-fiscal-e-virada/T402-periodo-em-paralelo-e-virada.md) | A fazer | M003 |
| M001 | [Mapa de campos da MarketUP](migracao/M001-mapa-de-campos-da-marketup.md) | A fazer | T001 |
| M002 | [Pedir a base completa à MarketUP](migracao/M002-pedir-a-base-completa-a-marketup.md) | A fazer | — |
| M003 | [Importadores e cargas](migracao/M003-importadores-e-cargas.md) | A fazer | M001, M002, T102, T103 |

Modelo para novas tarefas: `_modelo.md`.

## Depois da virada

| ID | Tarefa | Status | Depende de |
| --- | --- | --- | --- |
| P001 | [Grade de produtos](pos-virada/P001-grade-de-produtos.md) | A fazer | T103, T402 |
