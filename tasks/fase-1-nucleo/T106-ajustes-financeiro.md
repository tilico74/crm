# T106 — Ajustes › Financeiro (contas gerenciais, contas correntes, tipos de pagamento)

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T101 |
| Skills | `criar-api-modulo`, `criar-tela-listagem`, `criar-tela-formulario`, `mapear-entidade-marketup`, `revisar-acessibilidade-mobile` |
| Contexto | `context/marketup/telas-e-entidades.md` (seções Ajustes e "Ajustes › Financeiro em detalhe") |

## Objetivo

Cadastros financeiros da MarketUP que o módulo Financeiro (T302) vai usar.

## Critérios de aceite

- Conta gerencial: lista (Código, Nome, Tipo, DRE, Ativo) e ficha com Tipo, Conta origem, Posição relativa, Código referência, Classificação DRE, Nome, CC débito, CC crédito, Compras, Ativo; contas do sistema não podem ser excluídas
- Conta corrente: lista com edição na própria linha (Nome, Interna, Banco, Agência-dígito, Conta-dígito, Principal, Ativo), como na MarketUP
- Tipo de pagamento: lista (Descrição, Ativo) e ficha com Descrição, Início e fim de contrato, Carência, Ativo e as Condições de pagamento (descrição, parcelas, intervalo, 1ª parcela, % adm, % antecipação, valor fixo, compras?, vendas?)
- IDs iguais aos da MarketUP (sem dados iniciais: a carga vem da migração)
- Permissões `contas_gerenciais`, `contas_correntes`, `tipos_pagamento`

## Checklist

- [x] Modelos, API e testes
- [x] Telas

## Dúvidas

- [x] Lista de bancos: carregada da lista oficial do Banco Central (BrasilAPI) pelo comando `carregar_bancos`; chave = código de compensação com 3 dígitos ("001"), o mesmo da MarketUP. A conta corrente migrada liga ao banco por esse código.
- [ ] "Utiliza no PDV?" do tipo de pagamento ficou fora (PDV fora do escopo).

## Observações

- Back-end: `backend/apps/financeiro/` (`ContaGerencial`, `Banco`, `ContaCorrente`, `TipoPagamento` + `CondicaoPagamento`). API: `/api/contas-gerenciais`, `/api/bancos`, `/api/contas-correntes` (uma conta principal por vez), `/api/tipos-pagamento` (condições gravadas junto). Contas do sistema não podem ser excluídas.
- Bancos: `docker compose exec backend python manage.py carregar_bancos` (461 bancos; pode rodar de novo para atualizar).
- Telas (`frontend/src/resources/financeiro/`): Conta gerencial (lista em ordem de nome + ficha; DRE muda conforme Saída/Entrada), Conta corrente (edição na própria linha, Enter confirma, Esc cancela), Tipo de pagamento (lista + ficha com a tabela de condições editável na linha). Conferidas no Chrome em 08/11/2026; registros de teste apagados.
- Sem dados iniciais de contas e tipos: vêm da migração da MarketUP, com os IDs dela.
