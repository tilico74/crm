---
nome: criar-api-modulo
descricao: Padrão do back-end para um cadastro novo — modelo com auditoria, permissões pela matriz, API, testes e ligação com o menu.
entradas: módulo, campos (do mapa da MarketUP), funcionalidade da matriz de permissões
saidas: modelo, migração, API REST com permissão e auditoria, testes e rota do front-end liberada
---
# Criar a API de um módulo

Modelos prontos para copiar: `backend/apps/usuarios/` (lista com ficha) e `backend/apps/core/empresa.py` + `backend/apps/vendas/views.py` (registro único).

## Peças prontas (use, não recrie)

| Peça | Arquivo | Para quê |
| --- | --- | --- |
| `ModeloBase` | `backend/apps/core/models.py` | Toda tabela herda: `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por` |
| `AuditoriaViewSet` | `backend/apps/core/api.py` | ViewSet que grava quem criou e quem alterou |
| `PermissaoFuncionalidade` | `backend/apps/core/api.py` | Confere a matriz grupo × funcionalidade × ação. A view declara `funcionalidade = "<codigo>"`; GET = acessar, POST = adicionar, PUT/PATCH = alterar, DELETE = excluir. `funcionalidades_leitura = [...]` libera só a leitura por outra funcionalidade |
| `Paginacao` | `backend/apps/core/pagination.py` | 25 por página; o front pede mais com `page_size` ("Ver mais registros") |
| `CpfField`, `CnpjField`, `RgField`, `CepField`, `TelefoneField` | `backend/apps/core/documentos.py` | Campos do serializador: aceitam com ou sem máscara, gravam limpo, validam (skill `mascaras-e-formatos`) |
| `normalizar_nome` | `backend/apps/core/normalizacao.py` | Chame no `save()` do modelo para nomes e endereços (skill `normalizar-nomes`) |
| Localidades | `backend/apps/core/localidades.py` | CEP, estados e municípios (ADR-006); não chame ViaCEP/IBGE de outro lugar |

## Passo a passo

1. **Campos:** do mapa da MarketUP (`mapear-entidade-marketup`). Tabela e colunas em português (`db_table`), `id` = ID da MarketUP (BIGINT). Dinheiro e percentual em `DecimalField`, nunca float.
2. **Modelo** herdando `ModeloBase`. Nome de pessoa, empresa e endereço: `normalizar_nome` no `save()`. CPF e CNPJ com `validators=[validar_cpf]` / `[validar_cnpj]` (`documentos.py`).
3. **Funcionalidade:** se o módulo é novo na matriz, crie numa migração de dados (como `usuarios/0003_grupos_e_funcionalidades.py`) e dê acesso total ao grupo Administrador.
4. **Serializador:** documentos e telefones com os campos de `documentos.py`. Mensagens de erro em português, dizendo como corrigir.
5. **View:** `AuditoriaViewSet` com `funcionalidade = "..."`, `SearchFilter` nos campos de busca da MarketUP. Exclusão que quebraria histórico: devolva 400 com o motivo (ex.: grupo com usuários, conta do sistema).
6. **URLs:** `DefaultRouter(trailing_slash=False)` no `urls.py` do app e `path("api/", include(...))` em `backend/config/urls.py`.
7. **Admin:** registre com `unfold.admin.ModelAdmin`; auditoria como `readonly_fields`.
8. **Testes** (`backend/tests/test_<modulo>.py`, como `test_usuarios.py`): sem login = 401; grupo sem permissão = 403; ação permitida = 200/201; auditoria gravada; regras do módulo.
9. **Front-end:** ligue a rota à funcionalidade em `FUNCIONALIDADE_POR_ROTA` (`frontend/src/app/menu.ts`). Telas: skills `criar-tela-listagem` e `criar-tela-formulario`.
10. Rode: `docker compose exec backend python manage.py makemigrations <app>`, `migrate` e `pytest` (skill `executar-em-docker`).

## Verificação

- [ ] Herdou `ModeloBase`; a auditoria aparece nos testes.
- [ ] A view declara `funcionalidade`; os testes cobrem 401 e 403.
- [ ] CPF/CNPJ/telefone/CEP gravados limpos e validados.
- [ ] ID igual ao da MarketUP; nenhum float para dinheiro.
- [ ] Rota do front-end ligada em `FUNCIONALIDADE_POR_ROTA`.
