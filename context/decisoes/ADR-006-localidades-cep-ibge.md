# ADR-006: CEP e localidades pelo back-end (ViaCEP e IBGE)

- **Status:** Aceito em 07/11/2026.

## Contexto

Os cadastros (clientes, funcionários, empresa, fornecedores) têm endereço. Digitar tudo à mão gera erro e endereços diferentes para o mesmo lugar. Existem serviços públicos e gratuitos que resolvem isso:

- **ViaCEP** (`viacep.com.br`): endereço pelo CEP, e CEPs pelo endereço.
- **IBGE** (`servicodados.ibge.gov.br`): lista oficial de estados e municípios, com o código IBGE.

## Decisão

- O front-end **nunca** chama esses serviços direto. Usa 4 endpoints do back-end (`/api/localidades/...`, detalhes em `../integracoes/localidades.md`).
- **Todo campo de CEP de todo formulário** usa o componente `CepField`: ao completar 8 dígitos válidos, o endereço, o bairro, a cidade, a UF e o código IBGE são preenchidos na hora (número e complemento digitados ficam). Decidido em 08/11/2026.
- **Todo campo de Endereço de todo formulário** usa o componente `EnderecoField`: lupa acoplada que abre o modal `BuscaEnderecoModal` (UF, cidade e rua; lista a partir da 3ª letra; escolher preenche CEP, rua, bairro, cidade, UF e IBGE). Decidido em 08/11/2026.
- O back-end padroniza a resposta com os nomes de campo do RDX (`cidade`, não `localidade`), guarda em cache no Redis (CEP: 7 dias; estados e municípios: 30 dias) e devolve erros em português.
- Se o serviço externo cair, a resposta é **503** com a mensagem "Preencha o endereço manualmente". **O cadastro nunca fica bloqueado** por causa da consulta.
- Os endpoints só exigem login; não entram na matriz de permissões.
- Guardar o **código IBGE do município** junto com o endereço: a nota fiscal (T401) exige esse código.

## Por quê

- Um lugar só para trocar de fornecedor (ex.: BrasilAPI) sem mexer nas telas.
- Cache: as listas do IBGE quase não mudam, e o CEP repetido não gera nova consulta.
- Sem CORS, sem chave e sem dados do cliente saindo do navegador para terceiros: só o CEP ou o nome da rua sai do servidor.

## Consequências

- O servidor precisa de acesso à internet (`viacep.com.br` e `servicodados.ibge.gov.br`, porta 443).
- Endereços preenchidos pelo CEP ainda passam pela padronização de nomes (ADR-005) ao gravar.
