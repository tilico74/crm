---
nome: executar-em-docker
descricao: Como rodar qualquer comando do projeto sem instalar nada na máquina.
entradas: comando desejado
saidas: comando executado dentro do contêiner certo
---
# Executar em Docker

Decisão: `context/decisoes/ADR-001-docker.md`.

## Regras

- Nunca rode `pip`, `npm`, `python` ou `node` direto na máquina. Use o contêiner.
- Back-end: `docker compose exec backend <comando>`.
  - Exemplo: `docker compose exec backend python manage.py migrate`.
- Front-end: `docker compose exec frontend <comando>`.
  - Exemplo: `docker compose exec frontend npm test`.
- Nova dependência: entra no arquivo de dependências (`requirements` ou `package.json`) e na imagem, nunca só no contêiner em execução.
- Segredos só no `.env`, nunca no código nem no `docker-compose.yml`.

Subir, parar e ver logs: `docker/README.md`.
