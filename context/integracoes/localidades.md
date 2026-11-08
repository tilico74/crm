# Localidades: CEP, estados e municípios

Decisão: `../decisoes/ADR-006-localidades-cep-ibge.md`. Código: `backend/apps/core/localidades.py`. Cliente no front-end: `frontend/src/lib/localidades.ts`.

Todos os endpoints exigem login (token JWT) e respondem JSON.

| # | Endpoint | Fonte | Uso nos cadastros |
| --- | --- | --- | --- |
| 1 | `GET /api/localidades/cep/{cep}` | ViaCEP `/ws/{cep}/json/` | Componente `CepField`: ao completar 8 dígitos preenche rua, bairro, cidade e UF |
| 2 | `GET /api/localidades/enderecos?uf=RS&cidade=Porto Alegre&logradouro=Domingos` | ViaCEP `/ws/{uf}/{cidade}/{rua}/json/` | Modal `BuscaEnderecoModal` (lupa do `EnderecoField`): lista para escolher |
| 3 | `GET /api/localidades/estados` | IBGE `/localidades/estados?orderBy=nome` | Lista do campo UF |
| 4 | `GET /api/localidades/estados/{uf}/municipios` | IBGE `/localidades/estados/{uf}/municipios` | Lista do campo Cidade, depois de escolher a UF |

## Respostas

**1 e 2** (o 2 devolve uma lista, até 50 itens):

```json
{
  "cep": "01001-000",
  "logradouro": "Praça da Sé",
  "complemento": "lado ímpar",
  "bairro": "Sé",
  "cidade": "São Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "ddd": "11"
}
```

**3:** `[{ "id": 12, "sigla": "AC", "nome": "Acre", "regiao": "Norte" }, …]` (27 itens, por nome).

**4:** `[{ "id": 4200051, "nome": "Abdon Batista" }, …]` (por nome). `{uf}` aceita a sigla (`SC`) ou o código IBGE (`42`).

## Erros

| Situação | Código | `detail` / campo |
| --- | --- | --- |
| CEP sem 8 dígitos | 400 | `cep`: "CEP inválido. Confira os 8 dígitos." |
| CEP não existe | 404 | "CEP não encontrado. Confira o número ou preencha o endereço manualmente." |
| UF inexistente | 400 | `uf`: "UF "XX" não existe. Use a sigla do estado, ex.: SC." |
| Cidade ou rua com menos de 3 letras (regra do ViaCEP) | 400 | `cidade` / `logradouro` |
| ViaCEP ou IBGE fora do ar ou lento (mais de 8 s) | 503 | "Serviço de consulta indisponível no momento. Preencha o endereço manualmente." |

## Cache

Redis, banco 1 (`CACHE_URL`). CEP e pesquisa por endereço: 7 dias. Estados e municípios: 30 dias.
