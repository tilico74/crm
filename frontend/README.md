# frontend

Interface do sistema: **React 19 + TypeScript + Refine Core 5**, visual **shadcn/ui** (Tailwind CSS 4) com os tokens do [Design System RDX](https://claude.ai/artifact/8BK9ueCNVAfh9FwGGgXqaC) e ícones **Tabler** (`context/decisoes/ADR-003-frontend-refine.md`).

## Bibliotecas

| Biblioteca | Para quê |
| --- | --- |
| Vite 7 | Servidor de desenvolvimento e build |
| @refinedev/core + @refinedev/react-router | Listagens, formulários, rotas, login e permissões |
| @refinedev/simple-rest | Provedor de dados provisório (troca pelo adaptador da API Django) |
| tailwindcss 4 + tw-animate-css | Estilos usados pelo shadcn/ui |
| clsx, tailwind-merge, class-variance-authority | Utilitários dos componentes shadcn/ui (`src/lib/utils.ts`) |
| @tabler/icons-react | Ícones |
| @fontsource (Bai Jamjuree, PT Sans Narrow, JetBrains Mono) | Fontes servidas pelo próprio sistema, sem CDN |
| vitest + @testing-library/react + jsdom | Testes |

Versões em `package.json` e `package-lock.json`. Telemetria do Refine desligada.

## Comandos (sempre via Docker)

- Testes: `docker compose exec frontend npm test`
- Build: `docker compose exec frontend npm run build`
- Novo componente shadcn/ui: `docker compose exec frontend npx shadcn@latest add button` (configuração em `components.json`)
- Nova dependência: `docker compose exec frontend npm install <pacote>` e depois `docker compose build frontend`

## Estrutura

```
frontend/
├── Dockerfile
├── src/
│   ├── app/            # rotas e layout (coluna fixa de 992px)
│   ├── design-system/  # tokens.css: tokens RDX (claro e escuro)
│   ├── components/ui/  # componentes shadcn/ui
│   ├── resources/      # uma pasta por módulo (clientes, orcamentos…)
│   └── lib/            # utils, normalizarNome, formatadores de R$ e datas
└── tests/
```

Os tokens RDX ficam em `src/design-system/tokens.css` e são ligados às variáveis do shadcn/ui em `src/index.css`. Tema escuro: classe `dark` no `<html>`.
