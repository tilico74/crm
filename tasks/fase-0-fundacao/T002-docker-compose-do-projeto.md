# T002 — Docker Compose do projeto

| Campo | Valor |
| --- | --- |
| Status | A fazer |
| Depende de | T001 |
| Skills | `executar-em-docker` |
| Contexto | `context/decisoes/ADR-001-docker.md`, `docker/README.md` |

## Objetivo

Criar o docker-compose.yml com db (PostgreSQL), redis, backend, worker e frontend, configurados por .env.

## Critérios de aceite

- `docker compose up` sobe todos os serviços numa máquina limpa com só o Docker Desktop
- Volume nomeado para o banco
- .env.example lista todas as variáveis
- Funciona no Windows com WSL 2

## Checklist

- [ ] docker-compose.yml
- [ ] .env.example completo
- [ ] Healthcheck do banco
- [ ] README com os 3 comandos para subir, parar e ver logs

## Dúvidas

- [ ] Qual servidor de produção? (VPS, Azure, AWS ou GCP)
