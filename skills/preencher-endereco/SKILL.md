---
nome: preencher-endereco
descricao: Como um formulário com endereço usa CEP, estados e municípios (ViaCEP e IBGE pelo back-end).
entradas: formulário com campos de endereço
saidas: endereço preenchido pelo CEP, UF e cidade em listas oficiais, código IBGE gravado
---
# Preencher endereço

Decisão: `context/decisoes/ADR-006-localidades-cep-ibge.md`. Endpoints: `context/integracoes/localidades.md`. Cliente pronto: `frontend/src/lib/localidades.ts`.

## Quando usar

Em todo formulário com endereço: cliente, funcionário, empresa, fornecedor, endereço de entrega e de instalação.

## Passo a passo

1. **Ordem dos campos:** a da MarketUP (CEP primeiro). Guardar também `ibge` (código do município), oculto na tela; a nota fiscal precisa dele.
2. **CEP: use SEMPRE o componente `CepField`** (`frontend/src/components/CepField.tsx`). Nunca faça a consulta à mão.
   - Ao completar 8 dígitos (sem esperar sair do campo), ele consulta o CEP e chama `onEndereco`. No formulário: `onEndereco={(e) => mudarEndereco(camposDoCep(e))}` (`camposDoCep` vem de `frontend/src/lib/localidades.ts`).
   - Achou: preenche rua (`logradouro`), bairro, cidade, UF e `ibge`. **Não** apaga número nem complemento já digitados.
   - 404: mostre embaixo do campo "CEP não encontrado. Confira o número ou preencha o endereço manualmente." e deixe tudo editável.
   - 503 ou sem internet: mesma coisa, com a mensagem do servidor. **Nunca** bloqueie o salvamento.
3. **Endereço: use SEMPRE o componente `EnderecoField`** (`frontend/src/components/EnderecoField.tsx`): o campo tem a **lupa acoplada no final**, que abre o modal `BuscaEnderecoModal` ("Não sei o CEP").
   - O modal tem UF e Cidade (listas do IBGE, já abrem com as do formulário) e o campo Endereço; a partir da 3ª letra pesquisa e mostra a lista com rolagem (rua, complemento, bairro, cidade/UF, CEP).
   - Clicar num endereço fecha o modal e chama `onEndereco`. No formulário: `onEndereco={(e) => mudarEndereco({ cep: limpar("cep", e.cep), ...camposDoCep(e) })}`.
4. **UF:** lista de `listarEstados()` (sigla + nome). **Cidade:** lista de `listarMunicipios(uf)`, carregada ao escolher a UF; com busca por digitação (são até 853 municípios por estado).
5. **Endereço digitado à mão:** continua permitido. Ao gravar, rua, complemento, bairro e cidade ficam como digitados; endereço não é padronizado (ADR-007).
6. **Celular:** o CEP usa `inputMode="numeric"` e campo de 48px.

## Verificação

- [ ] O CEP usa `CepField`; ao completar 8 dígitos válidos preenche endereço, bairro, cidade e UF sem apagar o número.
- [ ] O Endereço usa `EnderecoField` (lupa); escolher no modal preenche CEP, rua, bairro, cidade e UF.
- [ ] CEP inexistente e serviço fora do ar mostram aviso e deixam salvar.
- [ ] UF e cidade vêm das listas do IBGE.
- [ ] O código IBGE do município é gravado.
