# T002 — Docker Compose do projeto

| Campo | Valor |
| --- | --- |
| Status | Concluída |
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

- [x] docker-compose.yml
- [x] .env.example completo
- [x] Healthcheck do banco
- [x] README com os 3 comandos para subir, parar e ver logs

## Dúvidas

- [ ] Qual servidor de produção? (VPS, Azure, AWS ou GCP)
- [ ] Serviço local de arquivos: a imagem do MinIO saiu do Docker Hub e do Quay. Usar uma alternativa compatível com S3 (ex.: SeaweedFS) ou outro caminho? Até decidir, os arquivos ficam no disco do contêiner e o `docker-compose.yml` não tem serviço de arquivos.
