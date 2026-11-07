---
nome: criar-tela-formulario
descricao: Monta o formulário de um módulo no modelo MarketUP com o Design System RDX.
entradas: módulo e lista de campos
saidas: formulário responsivo com validação
---
# Criar tela de formulário

Referência: componente FormPage do Design System RDX e `context/design-system/layout-e-telas.md`.

## Passo a passo

1. Abra o formulário equivalente na MarketUP (só leitura) e copie a **ordem dos campos, os rótulos e as seções**.
2. Bloco de cabeçalho com o quadro de status (136px) e os campos do documento.
3. Seções com título de 30px e 40px entre elas.
4. Grade de 4 colunas no computador, 2 no tablet e 1 no celular.
5. Campos de 34px no computador e 48px em tela de toque. Rótulo em PT Sans Narrow, 4px acima do campo.
6. Campos de nome e endereço aplicam `normalizar-nomes` ao sair do campo (prévia) e no back-end (gravação).
7. As mensagens de erro dizem o que está errado e como corrigir. Exemplo: "CNPJ inválido. Confira os 14 dígitos."

## Verificação

- [ ] Rótulos e ordem iguais aos da MarketUP.
- [ ] Um único botão principal.
- [ ] A skill `revisar-acessibilidade-mobile` passou.
