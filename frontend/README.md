# frontend

Interface do sistema: **React + TypeScript + Refine Core**, visual **shadcn/ui** com os tokens do [Design System RDX](https://claude.ai/artifact/8BK9ueCNVAfh9FwGGgXqaC) e ícones **Tabler** (`context/decisoes/ADR-003-frontend-refine.md`).

> Vazio de propósito. O esqueleto nasce na tarefa `tasks/fase-0-fundacao/T004-esqueleto-frontend.md`, dentro de Docker.

## Estrutura prevista

```
frontend/
├── Dockerfile
├── src/
│   ├── app/            # rotas e layout (coluna fixa de 992px)
│   ├── design-system/  # tokens RDX → variáveis do shadcn/ui
│   ├── components/     # ListPage, FormPage, Badge…
│   ├── resources/      # uma pasta por módulo (clientes, orcamentos…)
│   └── lib/            # normalizarNome, formatadores de R$ e datas
└── tests/
```
