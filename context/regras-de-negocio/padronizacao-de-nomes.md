# Padronização de nomes

**Regra:** nomes de pessoas, empresas e endereços são gravados com a **inicial maiúscula em cada palavra**, exceto as palavras de ligação (de, da, do, dos, das, e…), que ficam minúsculas.

A regra é aplicada **no back-end, antes de gravar**, sempre que o registro é criado, editado ou importado da MarketUP. O front-end aplica a mesma regra ao sair do campo, só para mostrar ao usuário como o nome será salvo.

Procedimento passo a passo: `skills/normalizar-nomes/SKILL.md`. Casos de teste oficiais, usados pelo back-end e pelo front-end: `skills/normalizar-nomes/casos.json`.

## Onde se aplica

| Aplica | Exemplos de campo |
| --- | --- |
| Pessoas | nome do cliente, nome do contato, nome do vendedor, nome do técnico |
| Empresas | razão social, nome fantasia |
| Endereços | logradouro (rua, avenida, praça, travessa…), bairro, cidade, complemento |

## Onde **não** se aplica

| Campo | Regra própria |
| --- | --- |
| E-mail | tudo minúsculo |
| UF | 2 letras maiúsculas (SP, PR) |
| CPF, CNPJ, CEP, telefone | só dígitos no banco; máscara na tela |
| Descrição de produto e serviço | como o usuário digitou |
| Observações e textos livres | como o usuário digitou |

## Palavras que ficam minúsculas (exceto se forem a primeira ou a última palavra)

`de`, `da`, `do`, `das`, `dos`, `e`, `em`, `na`, `no`, `nas`, `nos`, `a`, `o`, `as`, `os`, `com`, `por`, `para`, `del`, `della`, `di`, `du`, `van`, `von`, `y`

## Exceções que preservam maiúsculas

- Siglas e sufixos societários: LTDA, ME, EPP, EIRELI, S/A, SA, S.A., CIA, MEI.
- Algarismos romanos: I, II, III, IV, V, VI, VII, VIII, IX, X (ex.: Dom Pedro II).
- Abreviações de endereço com ponto mantêm a forma: Av., R., Pç., Trav., Est., Rod., Jd., Vl., Pq., Lot.
- Códigos de rodovia no formato letras-números ficam em maiúsculas (ex.: BR-116, SP-280).
- Siglas de uma **lista configurável** ficam em maiúsculas (começa com RDX, CNPJ, CPF, ONG, EPI). A lista é editável pelo administrador e fica em `skills/normalizar-nomes/casos.json` (chave `siglas`).

## Exemplos

| Digitado | Gravado |
| --- | --- |
| JOSÉ DA SILVA E SOUZA | José da Silva e Souza |
| maria dos santos | Maria dos Santos |
| rua das flores | Rua das Flores |
| PRAÇA DA SÉ | Praça da Sé |
| av. sete de setembro | Av. Sete de Setembro |
| condominio residencial do lago | Condominio Residencial do Lago |
| rdx redes de protecao ltda | RDX Redes de Protecao LTDA |
| rodovia br-116 km 12 | Rodovia BR-116 Km 12 |
| d'avila materiais | D'Avila Materiais |
| rua dom pedro ii | Rua Dom Pedro II |
| da costa transportes | Da Costa Transportes |
| rua a | Rua A |
| QUADRA B LOTE 3 | Quadra B Lote 3 |

> **Acentos:** a regra não corrige acentuação ("Protecao" continua sem acento). Correção ortográfica é outra coisa e não é feita automaticamente.
>
> **Migração:** o nome original da MarketUP fica no log de importação, para conferência. O ID não muda.
