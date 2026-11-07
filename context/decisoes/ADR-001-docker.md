# ADR-001: Docker em todos os ambientes

- **Status:** Aceito em 07/11/2026.

## Contexto

O projeto precisa ser fácil de exportar: instalar em outra máquina, outro servidor ou outra nuvem sem retrabalho. A equipe é pequena e usa Windows (`D:\workspace\crm`).

## Decisão

- Tudo roda em contêineres Docker, orquestrados por Docker Compose: banco, Redis, back-end, worker e front-end.
- Nenhuma dependência é instalada direto na máquina do desenvolvedor, além do Docker Desktop.
- Configuração por variáveis de ambiente (`.env`, nunca versionado; `.env.example` versionado).
- A mesma imagem vai do desenvolvimento para produção.

## Consequências

- **Exportar o sistema:** basta copiar o repositório e o `.env` e rodar `docker compose up`.
- **Windows:** usar Docker Desktop com WSL 2. Os volumes do banco ficam em volume nomeado, não em pasta do Windows, por desempenho.
- **Comandos:** os agentes de IA executam via `docker compose exec`, nunca direto no sistema.
