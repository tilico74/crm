---
nome: normalizar-nomes
descricao: Padroniza nomes de pessoas, empresas e endereços antes de gravar (inicial maiúscula, palavras de ligação minúsculas).
entradas: texto digitado ou importado (pode ser nulo)
saidas: texto padronizado
---
# Normalizar nomes

Regra de negócio: `context/regras-de-negocio/padronizacao-de-nomes.md`.
Casos de teste oficiais: `casos.json`, nesta pasta. Também traz as listas de partículas, siglas e romanos.

## Quando usar

Em todo campo de nome de pessoa, razão social, nome fantasia, logradouro, bairro, cidade e complemento, ao **criar, editar ou importar**. Nunca em e-mail, UF, documentos, telefone, descrições de produto ou textos livres.

## Passo a passo (independe de linguagem)

1. Se a entrada for nula, devolva nula.
2. Tire espaços do começo e do fim e troque espaços repetidos por um só.
3. Separe em palavras pelo espaço. Para cada palavra, na posição `i` (a primeira é 0):
   1. Separe pontuação final (`,` `;`) e devolva-a no fim.
   2. Código de rodovia (`letras-números`, ex.: `br-116`): tudo maiúsculo → `BR-116`.
   3. Está na lista de **siglas** (comparando em maiúsculas): tudo maiúsculo → `LTDA`, `S/A`, `RDX`.
   4. Não é a primeira palavra e está na lista de **romanos**: tudo maiúsculo → `II`.
   5. Não é a primeira nem a última palavra e está na lista de **partículas**: tudo minúsculo → `da`, `dos`, `e`.
   6. Não é a primeira palavra e começa com `d'`: `d'` minúsculo e o resto capitalizado → `d'Água`.
   7. Nos outros casos, **capitalize**: primeira letra maiúscula e o resto minúsculo. Depois de `-` ou `'`, a próxima letra também é maiúscula → `Ana-Maria`, `D'Avila`. Números e pontos ficam como estão → `Av.`, `120`.
4. Junte as palavras com um espaço.

## Verificação

- O código passa em **todos** os casos de `casos.json`, no back-end e no front-end, com o mesmo arquivo.
- Aplicar duas vezes dá o mesmo resultado que aplicar uma (idempotente).
- Na importação da MarketUP, o valor original fica no log da carga.
