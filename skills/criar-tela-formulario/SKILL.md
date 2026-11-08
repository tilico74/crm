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
| `AbaLista` + `OnOff` | `frontend/src/resources/clientes/AbaLista.tsx` | Aba da ficha no modelo MarketUP (Endereços, Contatos, Documentos…): linha de inclusão cinza com OK em cima e lista embaixo; lápis carrega a linha. Linhas novas têm id negativo só na tela; antes de enviar, tire esses ids (`semIdTemporario` em `ClienteForm.tsx`) e o back-end cria. Exemplo completo: `ClienteForm.tsx` e `ListaPrecoForm.tsx` |
| `BarraAcoes` | `frontend/src/resources/financeiro/BarraAcoes.tsx` | Aviso do resultado + barra fixa Voltar · (extras, ex.: Cancelar, Gerar pedido) · **Salvar · Salvar e voltar** (ordem da MarketUP) |
| `CampoNumero` + `numeroBr` | `frontend/src/components/CampoNumero.tsx` | Número em pt-BR como na MarketUP: mostra "R$ 0,05" / "2,990", aceita vírgula e entrega "0.05" para a API. Use em todo valor, quantidade e percentual digitado |
| `Modal` + `botaoCancelar` / `botaoConfirmar` | `frontend/src/components/Modal.tsx` | Modal no comportamento da MarketUP (fundo escuro 80%, caixa descendo do topo em 0,3 s, × quadrado), com as cores do RDX: faixa `line`, título `primary`, Cancelar `secondary`, Salvar `primary`. Foco inicial no campo com `data-autofocus`. Exemplo: `resources/orcamentos/DescontoItemModal.tsx` |
| `BalaoEdicao` | `frontend/src/components/BalaoEdicao.tsx` | Balão de 300px (fundo `line`, borda `secondary-light`) acima de um ícone, com seta, título, ×, texto e Cancelar / Confirmar — a "Observação" do item na MarketUP. Abre num portal (não é cortado por tabela com rolagem) |
| Impressão de documento de venda | `frontend/src/resources/orcamentos/OrcamentoImpressao.tsx` | Padrão aprovado em 08/11/2026 para orçamento e **pedido** (e outros documentos impressos):<br>• modelo da MarketUP: topo com logotipo e empresa, seções com faixa cinza, cobrança e entrega lado a lado;<br>• itens com Unid./Qtd. abreviadas, a linha "OBS:" de cada item, Observações sempre e assinaturas;<br>• folha A4 inteira: os itens empurram o fecho para o pé da página.<br>Rota fora do layout do sistema (`.../:id/imprimir`); "Imprimir / Salvar PDF" usa a impressão do navegador |
| `PageHeader` com `acoes` | `frontend/src/components/PageHeader.tsx` | Topo compacto das fichas com os ícones à direita (listar, imprimir, copiar, "Adicionar novo" verde). Exemplo: `OrcamentoForm.tsx` |
| `useMe` | `frontend/src/app/useMe.ts` | `pode(rota, "alterar")`: sem permissão, campos desabilitados e sem botão Salvar |
| `normalizarNome` | `frontend/src/lib/normalizarNome.ts` | Prévia da padronização ao sair de campo de nome de pessoa (skill `normalizar-nomes`) |
| `useOne`, `useCreate`, `useUpdate` (Refine 5) | — | Carregar e gravar; o estado de "salvando" é `mutation.isPending`; erros do DRF chegam em `erro.errors` por campo |

Padrões da tela: barra de ações fixa embaixo (Voltar | extras | **Salvar** | Salvar e voltar, ordem da MarketUP), aviso de sucesso/erro com `role="status"`, botões que não enviam o formulário com `type="button"`.

**Cores:** da MarketUP, copie layout, posições, tamanhos, efeitos e ações, nunca as cores. Use só os tokens do design system (`context/design-system/cores-e-tokens.md`):
- `primary` para ações e seleção;
- `secondary`, `line` e `ink-muted` para neutros;
- `success` só para status (pago, aprovado, concluído).

Não use cor em hexadecimal nos componentes. Texto sobre `primary` usa `text-primary-foreground`. Confira o tema claro e o escuro.

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
