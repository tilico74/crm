# Padronização de nomes

**Regra:** **nomes de pessoas** são gravados com a **inicial maiúscula em cada palavra**, exceto as palavras de ligação (de, da, do, dos, das, e…), que ficam minúsculas. Os acentos não são corrigidos: "Jose" continua "Jose".

Todo o resto (razão social, nome fantasia, endereços) é **gravado como foi digitado ou importado**, igual à MarketUP. Decisão: `../decisoes/ADR-007-padronizacao-so-nomes-de-pessoas.md`, que substitui o ADR-005.

A regra é aplicada **no back-end, antes de gravar**, sempre que o registro é criado, editado ou importado da MarketUP. O front-end aplica a mesma regra ao sair do campo, só para mostrar ao usuário como o nome será salvo.

Procedimento passo a passo: `skills/normalizar-nomes/SKILL.md`. Casos de teste oficiais, usados pelo back-end e pelo front-end: `skills/normalizar-nomes/casos.json`.

## Onde se aplica

| Aplica | Exemplos de campo |
| --- | --- |
| Pessoas | nome do cliente pessoa física, nome do contato, nome e apelido do funcionário, vendedor, técnico |

## Onde **não** se aplica (gravado como digitado)

| Campo | Regra própria |
| --- | --- |
| Razão social, nome fantasia | como o usuário digitou ou como veio da MarketUP |
| Endereço (logradouro, complemento, bairro, cidade) | como o usuário digitou, como veio do CEP ou da MarketUP |
| E-mail | tudo minúsculo |
| UF | 2 letras maiúsculas (SP, PR) |
| CPF, CNPJ, CEP, telefone | só dígitos no banco; máscara na tela |
| Descrição de produto e serviço | como o usuário digitou |
| Observações e textos livres | como o usuário digitou |

## Palavras que ficam minúsculas (exceto se forem a primeira ou a última palavra)

`de`, `da`, `do`, `das`, `dos`, `e`, `em`, `na`, `no`, `nas`, `nos`, `a`, `o`, `as`, `os`, `com`, `por`, `para`, `del`, `della`, `di`, `du`, `van`, `von`, `y`

## Exceções

- Algarismos romanos de I a XX ficam em maiúsculas: João Paulo II.
- Número seguido de letra: a letra fica maiúscula (7A); `º` e `ª` ficam como estão (2º).
- Depois de hífen ou apóstrofo a letra também é maiúscula: Ana-Maria, D'Avila.
- A função também conhece siglas (LTDA, ME…) e códigos de rodovia (BR-116), porque é a mesma de antes; em nome de pessoa isso quase nunca aparece.

## Exemplos

| Digitado | Gravado |
| --- | --- |
| JOSÉ DA SILVA E SOUZA | José da Silva e Souza |
| maria dos santos | Maria dos Santos |
| ana-maria dos reis | Ana-Maria dos Reis |
| leonardo di caprio | Leonardo di Caprio |
| jose da conceicao | Jose da Conceicao |

> **Migração:** o nome original da MarketUP fica no log de importação, para conferência. O ID não muda.
