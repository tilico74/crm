# Comissões

> **Rascunho.** As regras exatas ainda não foram levantadas com a RDX. Nada aqui deve ser implementado antes de a tarefa T205 confirmar cada item.

O que se sabe pela MarketUP:

- Comissão (`SellerCommissionID`) liga vendedor (`EmployeeID`) e pedido (`SaleOrderID`), ou cupom (`CouponID`).
- Campos observados: tipo de comissão, valor da venda, percentual, valor da comissão, data de emissão e de fechamento.
- Comissões são agrupadas em fechamentos (`SellerCommissionClosingID`).

## Dúvidas a responder

- [ ] A comissão é calculada sobre a venda ou sobre o recebimento?
- [ ] O percentual é por vendedor, por produto ou por serviço?
- [ ] O fechamento é mensal? Quem aprova?
