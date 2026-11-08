---
nome: criar-tela-formulario
descricao: Monta o formulário de um módulo no modelo MarketUP com o Design System RDX.
entradas: módulo e lista de campos
saidas: formulário responsivo com validação
---
# Criar tela de formulário

Referência: `context/design-system/layout-e-telas.md`. Modelo pronto para copiar: `frontend/src/resources/funcionarios/FuncionarioForm.tsx` (registro com lista) e `frontend/src/resources/empresa/InformacoesEmpresa.tsx` (registro único com endereços).

## Componentes prontos (use, não recrie)

| Peça | Arquivo | Para quê |
| --- | --- | --- |
| `FormSection` | `frontend/src/components/form.tsx` | Seção com título de 30px e grade de 4 colunas (2 no tablet, 1 no celular) |
| `TextField`, `SelectField`, `TextAreaField` | `frontend/src/components/form.tsx` | Campo com rótulo PT Sans Narrow, 34px (48px em toque), erro embaixo; `span` ocupa colunas |
| `SwitchField` | `frontend/src/components/form.tsx` | Interruptor OFF/ON da MarketUP (caixa de seleção acessível) |
| `MaskedField` | `frontend/src/components/form.tsx` | CPF, CNPJ, CPF/CNPJ, RG, CEP, telefone (skill `mascaras-e-formatos`) |
| `CepField` | `frontend/src/components/CepField.tsx` | CEP que preenche o endereço ao completar 8 dígitos (skill `preencher-endereco`) |
| `EnderecoField` + `BuscaEnderecoModal` | `frontend/src/components/` | Endereço com a lupa que abre a pesquisa "não sei o CEP" (skill `preencher-endereco`) |
| `PageHeader`, `ConfirmDialog` | `frontend/src/components/` | Faixa de topo e confirmação de exclusão |
| `useMe` | `frontend/src/app/useMe.ts` | `pode(rota, "alterar")`: sem permissão, campos desabilitados e sem botão Salvar |
| `normalizarNome` | `frontend/src/lib/normalizarNome.ts` | Prévia da padronização ao sair de campo de nome de pessoa (skill `normalizar-nomes`) |
| `useOne`, `useCreate`, `useUpdate` (Refine 5) | — | Carregar e gravar; o estado de "salvando" é `mutation.isPending`; erros do DRF chegam em `erro.errors` por campo |

Padrões da tela: barra de ações fixa embaixo (Voltar | Salvar e voltar | **Salvar**), aviso de sucesso/erro com `role="status"`, botões que não enviam o formulário com `type="button"`.

## Passo a passo

1. Abra o formulário equivalente na MarketUP (só leitura) e copie a **ordem dos campos, os rótulos e as seções**.
2. Bloco de cabeçalho com o quadro de status (136px) e os campos do documento.
3. Seções com título de 30px e 40px entre elas.
4. Grade de 4 colunas no computador, 2 no tablet e 1 no celular.
5. Campos de 34px no computador e 48px em tela de toque. Rótulo em PT Sans Narrow, 4px acima do campo.
6. Campos de nome de pessoa aplicam `normalizar-nomes` ao sair do campo (prévia) e no back-end (gravação); razão social, nome fantasia e endereço ficam como digitados. Endereço segue a skill `preencher-endereco` (CEP, UF e cidade). Documentos e telefones usam `MaskedField` (skill `mascaras-e-formatos`).
7. As mensagens de erro dizem o que está errado e como corrigir. Exemplo: "CNPJ inválido. Confira os 14 dígitos."

## Verificação

- [ ] Rótulos e ordem iguais aos da MarketUP.
- [ ] Todo CEP usa `CepField` e preenche o endereço ao completar 8 dígitos.
- [ ] Todo Endereço usa `EnderecoField` (lupa que abre a pesquisa de endereço).
- [ ] Um único botão principal.
- [ ] A skill `revisar-acessibilidade-mobile` passou.
