# RDX CRM/ERP

Sistema interno da RDX Redes de Proteção, que vai substituir a MarketUP. O projeto está organizado para ser lido e executado por agentes de IA ("AI-Ready").

> **Estado atual:** fase de planejamento. Nenhuma tecnologia foi instalada ainda; `backend/` e `frontend/` têm só o README.

## Onde está cada coisa

| Pasta | Para quê |
| --- | --- |
| `AGENTS.md` | **Comece aqui.** Regras que todo agente de IA segue neste repositório. |
| `context/` | O que é verdade no projeto: visão, princípios, arquitetura, regras de negócio, design system e referência da MarketUP. |
| `skills/` | Como fazer: procedimentos reutilizáveis (normalizar nomes, criar tela de listagem, mapear entidade da MarketUP…). |
| `tasks/` | O que fazer: tarefas numeradas por fase, com critérios de aceite e checklist. |
| `backend/` | API (Python + Django). Vazio até a tarefa T003. |
| `frontend/` | Interface (React + Refine). Vazio até a tarefa T004. |
| `docker/` | Arquivos de contêiner compartilhados. Vazio até a tarefa T002. |

## Documentos externos

- [Especificação do sistema](https://claude.ai/artifact/UfvALnMUtC5tFGekvDyVWY)
- [Design System RDX](https://claude.ai/artifact/8BK9ueCNVAfh9FwGGgXqaC)
