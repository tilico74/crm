# T205 — Comissões

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T203 |
| Skills | `criar-tela-listagem` |
| Contexto | `context/regras-de-negocio/comissoes.md` |

## Objetivo

Cálculo, lançamento e fechamento de comissões, com as regras que a RDX definir.

## Critérios de aceite

- Regras confirmadas com a RDX antes de implementar
- Totais por vendedor conferidos com exemplos reais do usuário (a MarketUP não serve de base: lá está tudo zerado)

## Pesquisa na MarketUP (09/11/2026, só leitura)

- Telas "Lançamento de comissões" e "Aprovação de comissões" (fechamentos). Campos em `context/regras-de-negocio/comissoes.md`.
- **A RDX não usa comissão desde julho de 2017**: 79 lançamentos (abril a julho de 2017), todos com 0% e R$ 0,00, nenhum fechado. Nada a migrar.
- Incidente sem efeito no servidor: ao ler a lista, a lembrança de paginação da listagem no navegador (`localStorage` `dataPageLocalStorage`) ficou na página 7 e a tela mostrou "nenhum registro". A chave foi apagada e regravada na página 1; a listagem voltou ao normal. Lição: carregar mais registros só pelo botão da tela, nunca chamando a função direto.

- Como calcula (código das telas): automática ao concluir o pedido, sobre o **total do pedido com desconto** (pedido 135: 295,00 = 369,05 − 74,05), % **do vendedor** (`User.ComissionPercentage`), comissão = venda × % ÷ 100; lançamento manual também existe; fechamento (aprovação) junta lançamentos e gera uma **conta a pagar**. Cancelamento não é visível nas telas. Tabela completa em `context/regras-de-negocio/comissoes.md`.
- Não foi possível abrir a ficha de aprovação com um lançamento marcado (marcar mexeria na seleção da tela da MarketUP; barrado pela segurança). O modelo da tela foi lido do servidor (só leitura).
- Decisão do usuário (09/11/2026): comissão **só para vendedores**.

## Checklist

- [x] Pesquisa na MarketUP
- [x] Confirmar regras (09/11/2026): seguir a MarketUP; frete fora da base; cancelamento apaga a comissão em aberto e estorna a fechada; aprova o gerente (permissão "Aprovação de comissões"), ninguém aprova a própria
- [x] Modelo e API (`backend/apps/comissoes`: `Comissao`, `FechamentoComissao`, `regras.py`; `financeiro.ContaPagar` mínima)
- [x] Telas: Comissões (lista com seleção e "Fechar selecionados"), ficha do lançamento, Aprovação (lista e ficha com registro financeiro e "Desfazer fechamento")
- [x] Fechamento: gera uma conta a pagar por vendedor (conta gerencial "Comissão de vendas", se existir); 7 testes em `tests/test_comissoes.py`
- [x] Conferência do usuário no navegador (09/11/2026)
- [ ] Pagar a conta a pagar da comissão (T302)

## Dúvidas

- Ver a lista em `context/regras-de-negocio/comissoes.md` (base de cálculo, percentual, descontos/cancelamentos, fechamento e aprovação).
