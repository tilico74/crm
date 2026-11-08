# Instruções para agentes de IA

Leia este arquivo inteiro antes de qualquer alteração.

## Ordem de leitura

1. `context/README.md`: índice do contexto.
2. `context/01-principios.md`: as regras que vencem qualquer outra.
3. A tarefa que você vai executar, em `tasks/`.
4. As skills que a tarefa cita, em `skills/`.

## Regras fixas

1. **Na dúvida, siga a MarketUP.** Telas, fluxos, nomes de campos, medidas e IDs seguem a MarketUP. As únicas exceções estão em `context/01-principios.md`.
2. **IDs iguais aos da MarketUP.** Nunca gere uma nova numeração para registros migrados (`context/regras-de-negocio/ids-marketup.md`).
3. **Nomes de pessoas padronizados.** Todo nome de pessoa passa pela skill `skills/normalizar-nomes/SKILL.md` antes de ser gravado. Razão social, nome fantasia e endereço ficam como digitados (ADR-007).
4. **Tudo roda em Docker.** Nenhuma dependência é instalada direto na máquina (`context/decisoes/ADR-001-docker.md`).
5. **Sem propaganda.** Nenhuma tela mostra anúncio, banner promocional ou oferta.
6. **Uma tarefa por vez.** Trabalhe só no escopo da tarefa aberta. Ao terminar, marque o checklist e mude o status no cabeçalho.
7. **Não invente.** Fato que não está em `context/` vira pergunta na seção "Dúvidas" da tarefa, não suposição.

## Convenções

- Idioma: português do Brasil em textos, telas e documentação. Código (variáveis, funções) em inglês; tabelas e colunas do banco em português, conforme `context/03-modelo-de-dados.md`.
- Datas: `DD/MM/AAAA` na tela, ISO 8601 no banco e na API.
- CPF, CNPJ, RG, CEP e telefone: máscara só na tela, valor limpo no banco (`context/regras-de-negocio/formatos.md`, skill `mascaras-e-formatos`).
- **CEP em qualquer formulário: componente `CepField`**, que preenche endereço, bairro, cidade e UF ao completar 8 dígitos válidos (ADR-006, skill `preencher-endereco`).
- **Endereço em qualquer formulário: componente `EnderecoField`**, com a lupa que abre o modal de pesquisa por UF, cidade e rua para quem não sabe o CEP.
- Dinheiro: `R$ 1.234,56` na tela; decimal com 2 casas no banco, nunca float.
- Novas decisões de arquitetura viram um ADR em `context/decisoes/`.
