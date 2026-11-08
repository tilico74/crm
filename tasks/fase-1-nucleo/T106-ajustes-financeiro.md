# T106 — Ajustes › Financeiro (contas gerenciais, contas correntes, tipos de pagamento)

| Campo | Valor |
| --- | --- |
| Status | Em andamento |
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

- [ ] Modelos, API e testes
- [ ] Telas

## Dúvidas

- [ ] Lista de bancos: a MarketUP tem a lista oficial (endpoint `Bank`). Carregar na migração ou de uma fonte pública?
- [ ] "Utiliza no PDV?" do tipo de pagamento ficou fora (PDV fora do escopo).
