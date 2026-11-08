# T102 — Clientes

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T101, T104, M001 |
| Skills | `criar-api-modulo`, `mapear-entidade-marketup`, `criar-tela-listagem`, `criar-tela-formulario`, `normalizar-nomes`, `preencher-endereco`, `mascaras-e-formatos` |
| Contexto | `context/03-modelo-de-dados.md`, `context/regras-de-negocio/` |

## Objetivo

Cadastro de clientes (PF e PJ), contatos, endereços e lista de preço, com ID = ClientID.

## Critérios de aceite

- Campos e ordem iguais aos da MarketUP
- Nome de cliente pessoa física e de contato padronizados ao gravar; razão social, nome fantasia e endereço como digitados (ADR-007)
- CPF e CNPJ validados
- Listagem e formulário no modelo MarketUP

## Checklist

- [ ] Modelo e API
- [ ] Listagem
- [ ] Formulário
- [ ] Testes

## Dúvidas

- Nenhuma por enquanto.
