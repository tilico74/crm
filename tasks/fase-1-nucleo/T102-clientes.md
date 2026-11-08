# T102 — Clientes

| Campo | Valor |
| --- | --- |
| Status | Em revisão |
| Depende de | T101, T104, M001 |
| Skills | `criar-api-modulo`, `mapear-entidade-marketup`, `criar-tela-listagem`, `criar-tela-formulario`, `normalizar-nomes`, `preencher-endereco`, `mascaras-e-formatos` |
| Contexto | `context/marketup/telas-e-entidades.md` (Cliente e Lista de preços), `context/regras-de-negocio/` |

## Objetivo

Cadastro de clientes (PF e PJ), contatos, endereços e lista de preço, com ID = ClientID.

## Critérios de aceite

- Campos e ordem iguais aos da MarketUP
- Nome de cliente pessoa física e de contato padronizados ao gravar; razão social, nome fantasia e endereço como digitados (ADR-007)
- CPF e CNPJ validados
- Listagem e formulário no modelo MarketUP

## Checklist

- [x] Levantamento na MarketUP (ficha, abas, lista de preços, IDs dos tipos) e exportação `migracao/dados/ListaClientes.xlsx`
- [x] Modelo e API: `backend/apps/clientes` — `/api/clientes`, `/api/listas-precos`, `/api/tipos-documento`, anexo em `/api/clientes/{id}/documentos/{doc}/arquivo`
- [x] Dados iniciais com IDs da MarketUP: lista "Padrão" (1) e tipos de documento 6, 11, 12, 13, 14
- [x] Listagem (Nome, Tipo, Telefone, Celular, Email + filtros da MarketUP)
- [x] Formulário: Ficha cadastral, Dados fiscais e abas Endereços, Contatos, Dados bancários, Documentos, Crédito, Histórico
- [x] Lista de preços / Tipos de clientes (descontos R$ ou %, itens com desconto diferenciado)
- [x] Testes (`backend/tests/test_clientes.py`)
- [x] Teste na tela (Chrome, 08/11): cadastro PF, CEP preenchendo endereço, contato padronizado, listagem e lista de preços; cliente de teste apagado
- [ ] Aprovação do usuário

## Decisões

- Como na MarketUP, `nome` guarda Nome **ou** Razão Social e `apelido` guarda Apelido **ou** Nome Fantasia. Padronização só quando é pessoa física.
- Ao gravar, os campos do outro tipo de pessoa são limpos (física não guarda CNPJ/IE/IM; jurídica não guarda CPF/RG/sexo/aniversário).
- CPF e CNPJ não se repetem entre clientes (a API avisa qual cliente já tem).
- Endereço: um só padrão; se nenhum for marcado, o primeiro ativo vira o padrão. IDs das linhas das abas não mudam ao salvar (pedidos vão apontar para o endereço).

## Pendências (dependem de outras tarefas)

- Aba Crédito: "utilizado" e as parcelas vêm do Contas a receber (fase 3); hoje mostra limite e disponível.
- Histórico automático de orçamentos, pedidos e OS: tarefa T206. Botão "Adicionar pedido de venda": T203.
- ~~Carga dos clientes~~: feita em 08/11/2026 (M003, comando `importar_clientes`); próximo ID automático 3296.

## Dúvidas

- Nenhuma por enquanto.
