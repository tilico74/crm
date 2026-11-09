# Comissões

> Regras decididas pelo usuário em 09/11/2026 e implementadas na T205 (`backend/apps/comissoes/regras.py`).

## O que a MarketUP tem (conferido em 09/11/2026, só leitura)

- **Lançamento de comissões** (`seller_commission`): Data · Fechamento · Comissionado · Venda · % Comissão · Comissão, com lápis e lixeira; filtros, imprimir, exportar, "Adicionar novo".
- Registro `SellerCommission`: SellerCommissionID, CommissionType, EmployeeID, SellerCommissionClosingID, CouponID, SaleOrderID, IssueDate, ClosingDate, Observation, SaleValue, Commission (%), CommissionValue.
- **Aprovação de comissões** (`seller_commission_closing`): fechamentos que agrupam lançamentos. Na conferência, a tela ficou carregando e não abriu.
- Percentual de comissão também aparece no cadastro do funcionário/usuário ("Comissão (%)"); no RDX: `Funcionario.comissao`.

## Uso real na RDX

- **79 lançamentos, todos de 28/04/2017 a 19/07/2017, todos com 0% e R$ 0,00**, nenhum fechado, nenhum de cupom (PDV). Por vendedor: 2 Esther (51), 1142 Nelson (17), 25 Cristian (9), 75 funcionário antigo (2).
- Ou seja: **a RDX não usa comissão na MarketUP desde julho de 2017.** Não há regra a copiar nem valor a migrar; os 79 lançamentos zerados não precisam vir.

## Como a MarketUP calcula (código das telas, 09/11/2026, só leitura)

| Pergunta | MarketUP |
| --- | --- |
| Para quem | Vendedor do pedido (`SellerID`) ou do cupom. **Decisão do usuário (09/11/2026): só vendedores.** |
| Quando nasce | Tipo **Automático** (os 79 de 2017): gerado sozinho ao **concluir o pedido** (faturar). Tipo **Manual**: lançado na tela, escolhendo o pedido ou cupom. |
| Base de cálculo | **Valor da venda = total do pedido** (`saleOrder.Value`), já **com o desconto**. Conferido: pedido 135, subtotal 369,05 − desconto 74,05 = 295,00, comissão lançada sobre 295,00. Não é sobre o recebido. Frete e outros custos entram no total do pedido (não houve exemplo com frete para conferir). |
| Percentual | **Um por vendedor**: `User.ComissionPercentage` (o "Comissão (%)" do usuário/funcionário). Não há % por produto. No lançamento, o % pode ser mudado. |
| Cálculo | `comissão = round(venda × % ÷ 100, 2)`. Digitando o valor, o % é recalculado; o valor não pode passar o da venda ("O valor da comissão não pode ser superior ao valor da venda."). % ≤ 0 → comissão 0. |
| Fechamento / aprovação | Na lista, marcam-se lançamentos e "fechar" abre a **Aprovação de comissões** (`seller_commission_closing`): lançamentos escolhidos + Data, Descrição, **Valor total**. Ao salvar, gera um **registro financeiro** (`FinancialEventID`, botão "Ver registro financeiro"): uma **conta a pagar**. O lançamento ganha a data de fechamento. Não há período fixo: fecha quando quiser (ex.: mensal). |
| Cancelamento / devolução | Não visível no código das telas (é do servidor) e não há exemplo real (tudo 0% desde 2017). **No RDX (decisão de 09/11/2026):** em aberto é apagada; já fechada recebe estorno negativo que entra no próximo fechamento. |

## Dúvidas a responder (usuário)

- [x] Para quem: vendedores (09/11/2026).
- [x] Seguir a MarketUP: automática ao concluir o pedido, sobre o total com desconto, % do vendedor (09/11/2026).
- [x] Frete **não** entra na base (09/11/2026).
- [x] Cancelamento: em aberto é apagada; fechada recebe estorno negativo para o próximo fechamento (09/11/2026).
- [x] Aprova o gerente acima do vendedor (permissão "Aprovação de comissões"); fecha quando quiser, como na MarketUP; gera conta a pagar (09/11/2026).
