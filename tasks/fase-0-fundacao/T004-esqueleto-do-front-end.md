# T004 — Esqueleto do front-end

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T002 |
| Skills | `executar-em-docker`, `criar-tela-listagem` |
| Contexto | `context/decisoes/ADR-003-frontend-refine.md`, `context/design-system/` |

## Objetivo

Criar o front-end a partir do template de CRM do Refine, com shadcn/ui, tokens RDX, fontes Bai Jamjuree e PT Sans Narrow e ícones Tabler.

## Critérios de aceite

- Layout com menu lateral e coluna fixa de 992px
- Tokens RDX ligados às variáveis do shadcn/ui
- Tema claro e escuro
- Sem a faixa "This example is open source" nem links promocionais
- Interface em português

## Checklist

- [x] Dockerfile do front-end
- [x] Tokens e fontes
- [x] Layout base
- [x] Ícones Tabler no menu

## Dúvidas

- Nenhuma por enquanto.

## Observações

- Instalado: Vite, React, Refine Core, shadcn/ui (Tailwind 4, `components.json`), Tabler Icons, fontes e tokens RDX claro e escuro.
- Layout medido na MarketUP em 07/11/2026 e reproduzido: barra superior de 64px; menu lateral de 88px que abre com nomes (230px) e um painel de subitens, ao passar o mouse ou ao clicar, e fecha sozinho quando o mouse sai; faixa de topo com módulo, título, "ocultar", busca com 4 filtros, 4 blocos de 76px e "Adicionar novo" de 152px; espaço do anúncio vazio. Menu na ordem da MarketUP, sem PDV, loja virtual e restaurantes.
- O template de CRM do Refine **não** foi usado: o layout dele é diferente do da MarketUP, e a regra "na dúvida, siga a MarketUP" vence. O Refine continua sendo usado para dados, rotas e permissões.
- Arquivos: `src/app/layout/` (AppShell, TopBar, SideNav), `src/app/menu.ts`, `src/components/PageHeader.tsx`, `src/components/ListToolbar.tsx`. Cada item do menu abre uma página provisória até o módulo existir.
