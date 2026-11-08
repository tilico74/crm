---
nome: mascaras-e-formatos
descricao: Como mostrar e receber CPF, CNPJ, RG, CEP, telefone, dinheiro, percentual e data em qualquer tela.
entradas: campo de formulário, coluna de listagem ou texto com esses dados
saidas: valor formatado na tela, limpo e validado na API e no banco
---
# Máscaras e formatos

Regra e tabela de formatos: `context/regras-de-negocio/formatos.md`.

## Quando usar

Sempre que uma tela **mostra** ou **recebe** CPF, CNPJ, RG, CEP, telefone, celular, WhatsApp, dinheiro, percentual ou data. Nunca escreva máscara à mão numa tela.

## Passo a passo

### Formulário (front-end)

1. Use `MaskedField` (`frontend/src/components/form.tsx`) com `mascara="cpf" | "cnpj" | "cpfCnpj" | "rg" | "cep" | "telefone" | "ncm" | "cest"`.
2. O estado do formulário guarda o valor **limpo**: `value={dados.cpf}` e `onChange={(v) => set("cpf", v)}`.
3. O campo já define o teclado do celular, o tamanho máximo e a validação ao sair do campo. Erros do servidor vêm em `error`.
4. CEP: junte com a skill `preencher-endereco` (`onBlur` chama a consulta).

### Listagem e textos (front-end)

5. Use `formatar(tipo, valor)` ou `formatarTelefone`, `formatarCpfCnpj`, `formatarMoeda`, `formatarPercentual`, `formatarData` de `frontend/src/lib/mascaras.ts`. Números com `tabular-nums`.

### API (back-end)

6. No serializador, declare o campo com o tipo certo: `cpf = CpfField()`, `cnpj = CnpjField()`, `rg = RgField()`, `cep = CepField()`, `telefone = TelefoneField()` (`backend/apps/core/documentos.py`). Eles aceitam com ou sem máscara, gravam limpo e recusam inválido com mensagem em português.
7. Importação da MarketUP: limpe com `so_digitos` / `limpar_cnpj` / `limpar_rg` antes de gravar. Documento inválido vindo da MarketUP **não** é descartado: registre no relatório da carga (`validar-migracao`).
8. PDF, e-mail e admin: `formatar_cpf`, `formatar_cnpj`, `formatar_cep`, `formatar_telefone`.

## Verificação

- [ ] Nenhuma máscara escrita à mão na tela.
- [ ] O banco guarda só dígitos (e letras no CNPJ alfanumérico).
- [ ] CPF e CNPJ inválidos são recusados com mensagem que diz como corrigir.
- [ ] CNPJ alfanumérico aceito.
