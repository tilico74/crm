# skills — como fazer

Cada skill é um procedimento reutilizável, numa pasta própria com um `SKILL.md`. As tarefas (`tasks/`) dizem **o que** fazer e citam as skills que dizem **como**.

## Formato de um SKILL.md

```markdown
---
nome: kebab-case
descricao: uma frase dizendo quando usar
entradas: o que a skill recebe
saidas: o que a skill entrega
---
# Título
## Quando usar
## Passo a passo
## Verificação
```

## Skills disponíveis

| Skill | Quando usar |
| --- | --- |
| `normalizar-nomes` | Antes de gravar nome de pessoa, empresa ou endereço |
| `preencher-endereco` | Em todo formulário com endereço: `CepField` (CEP preenche o endereço) e `EnderecoField` (lupa que abre a pesquisa por UF, cidade e rua) |
| `mascaras-e-formatos` | Ao mostrar ou receber CPF, CNPJ, RG, CEP, telefone, dinheiro, percentual ou data |
| `mapear-entidade-marketup` | Ao criar uma tabela que recebe dados da MarketUP |
| `criar-api-modulo` | Ao criar o back-end de um cadastro: modelo com auditoria, permissões, API, testes e ligação com o menu |
| `criar-tela-listagem` | Ao criar a listagem de um módulo (componentes prontos: `PageHeader`, `ListToolbar`, `DataTable`) |
| `criar-tela-formulario` | Ao criar o formulário de um módulo (componentes prontos: `FormSection`, campos, `MaskedField`, `CepField`, `EnderecoField`) |
| `validar-migracao` | Depois de cada carga de dados da MarketUP |
| `revisar-acessibilidade-mobile` | Antes de dar uma tela por pronta |
| `executar-em-docker` | Sempre que precisar rodar qualquer comando |
