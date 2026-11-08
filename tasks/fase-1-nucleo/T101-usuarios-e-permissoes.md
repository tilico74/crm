# T101 — Usuários e permissões

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T003, T004 |
| Skills | — |
| Contexto | `context/00-visao-geral.md` |

## Objetivo

Login, perfis (admin, vendedor, financeiro, técnico) e permissões por módulo.

## Critérios de aceite

- Login com JWT
- Cada perfil vê só os módulos permitidos
- Toda alteração registra quem fez

## Checklist

- [x] Modelo de usuário e perfil
- [x] Tela de login
- [x] Gestão de usuários

## Dúvidas

- [x] Os perfis previstos aqui (admin, vendedor, financeiro, técnico) são diferentes dos 9 grupos da MarketUP (Administrador, Administrativo, Auxiliar Administrativo, Comprador, Gerente, Gerente + Administrativo, Operador PDV, Vendedor, Vendedor Redex). Seguir a MarketUP (sem Operador PDV) e acrescentar Técnico?
  - **Decidido (07/11/2026):** grupos da MarketUP, sem "Operador PDV", mais o grupo "Técnico".
- [x] Na MarketUP o usuário fica dentro do funcionário (login, senha, perfil, "Vendedor?", comissão %). Manter assim: tabela `vendedor`/funcionário com `usuario_id`, como está em `context/03-modelo-de-dados.md`?
  - **Decidido (07/11/2026):** sim, igual à MarketUP.
- [x] Permissões por funcionalidade com Acessar/Adicionar/Alterar/Excluir, como na MarketUP (`context/marketup/telas-e-entidades.md`, seção Ajustes)?
  - **Decidido (07/11/2026):** sim, mesma matriz.

## Observações

- **Back-end** (`backend/apps/usuarios/`): `Funcionario` (ficha da MarketUP, com nome padronizado ao gravar), `Usuario` (login, ligado ao funcionário e a um `Grupo`), `Funcionalidade` e `PermissaoGrupo` (matriz acessar/adicionar/alterar/excluir). Grupos e funcionalidades criados pela migração `0003`; só o Administrador nasce com acesso.
- **Auditoria:** `apps/core/models.py` (`ModeloBase`: criado/atualizado em e por) e `apps/core/api.py` (`AuditoriaViewSet` grava o usuário; `PermissaoFuncionalidade` confere a matriz em toda chamada).
- **API:** `/api/auth/token/`, `/api/auth/me`, `/api/funcionarios`, `/api/grupos`, `/api/grupos/{id}/permissoes`, `/api/funcionalidades`.
- **Telas:** login; Ajustes › Funcionários (lista e ficha); Ajustes › Usuários (funcionários com login); Ajustes › Permissões (grupos e matriz). O menu e os botões seguem as permissões; endereço sem permissão mostra "Sem permissão".
- Excluir funcionário desativa o login (não apaga, para manter o histórico). Grupo com usuários não pode ser excluído.
- **Fica para depois:** as seções Características, Endereços, Contatos, Dados bancários e Documentos da ficha entram com a T102 (são as mesmas do cliente). A tela "Usuários" da MarketUP não foi conferida (o navegador caiu); a do RDX lista os funcionários com login.
- **Migração:** a exportação de Funcionários da MarketUP não traz o EmployeeID (ver M001/M002).
