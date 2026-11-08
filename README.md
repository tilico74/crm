# RDX CRM/ERP

Sistema interno da RDX Redes de Proteção, que vai substituir a MarketUP. O projeto está organizado para ser lido e executado por agentes de IA ("AI-Ready").

> **Estado atual:** base tecnológica instalada (fase 0: T002 a T004 concluídas). Para subir: `docker/README.md`.

## Onde está cada coisa

| Pasta | Para quê |
| --- | --- |
| `AGENTS.md` | **Comece aqui.** Regras que todo agente de IA segue neste repositório. |
| `context/` | O que é verdade no projeto: visão, princípios, arquitetura, regras de negócio, design system e referência da MarketUP. |
| `skills/` | Como fazer: procedimentos reutilizáveis (normalizar nomes, criar tela de listagem, mapear entidade da MarketUP…). |
| `tasks/` | O que fazer: tarefas numeradas por fase, com critérios de aceite e checklist. |
| `backend/` | API (Python + Django). |
| `frontend/` | Interface (React + Refine). |
| `docker/` | Como subir, parar e ver logs dos contêineres. |

## Documentos externos

- [Especificação do sistema](https://claude.ai/artifact/UfvALnMUtC5tFGekvDyVWY)
- [Design System RDX](https://claude.ai/artifact/8BK9ueCNVAfh9FwGGgXqaC)
