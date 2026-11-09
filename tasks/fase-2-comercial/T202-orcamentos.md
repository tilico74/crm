# T202 — Orçamentos

| Campo | Valor |
| --- | --- |
| Status | Concluída |
| Depende de | T102, T103 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario` |
| Contexto | `context/marketup/telas-e-entidades.md` (Orçamento), `context/marketup/medidas-telas.md` |

## Objetivo

Orçamentos com validade, entrega, itens, desconto e status; número = SaleBudgetID.

## Critérios de aceite

- Listagem e formulário idênticos em estrutura à MarketUP
- Impressão em PDF
- Converte em pedido

## Checklist

- [x] Levantamento na MarketUP (orçamentos 3874 e 3869, filtros, status, campos do modelo Angular) e exportação `migracao/dados/ListaOrcamentoVenda.xls`
- [x] Modelo e API: `backend/apps/vendas` — `Orcamento`, `ItemOrcamento`, `ParcelaOrcamento`; `/api/orcamentos` com `novo`, `vendedores`, `gerar-parcelas`, `{id}/cancelar`, `{id}/copiar`
- [x] Cálculo no servidor (`apps/vendas/calculo.py`), conferido com o orçamento 3874 (620,05 − 0,05 = 620,00)
- [x] Telas: listagem (número + status com faixa colorida, validade/entrega, cliente, data, valor; filtros da MarketUP) e ficha (Orçamento, Cliente, Itens, Pagamento)
- [x] PDF: `/vendas/orcamentos/{id}/imprimir` (A4, "Imprimir / Salvar PDF")
- [x] Testes: `backend/tests/test_orcamentos.py`, `frontend/tests/orcamentos.test.ts`
- [x] Teste na tela (Chrome, 08/11) com dados descartáveis, apagados depois
- [x] Converter em pedido ("Gerar pedido"): feito na T203 (salva, confirma e abre o pedido novo com a cópia; com o pedido gravado o orçamento fica Concluído)

## Conferência com a MarketUP (08/11/2026)

Orçamento 3874 recriado no RDX com os mesmos dados: itens, quantidades, unitários, subtotal 620,05, desconto 0,05 e total 620,00 iguais. Ajustes de tela feitos depois da comparação: ícones do topo à direita (listar, imprimir, copiar, Adicionar novo), números em pt-BR (2,990 · 78,19 · R$ 0,05), círculo da foto e código de barras no item, ⊖/⊕ no quadro de ajustes, "Total final (R$)" grande fora do quadro, "Total a pagar (R$)" e valor já preenchido no Pagamento, rodapé Cancelar · Gerar pedido · Salvar · Salvar e voltar.

Ações da linha do item (conferidas no 3874): o **balão verde** abre o balão flutuante "Observação" (300px, cinza, seta, Cancelar/Confirmar, até 300 caracteres) e o **%** abre o modal "Desconto no item" (750px: foto, código e nome; Quantidade, Unidade, Valor unitário, Desconto em R$/%, Desconto; Valor final; Cancelar/Salvar). No RDX: `BalaoEdicao` e `DescontoItemModal`; quantidade e unitário da linha abrem o mesmo modal. O campo GTIN do modal não entrou (é da nota fiscal, T401).

**Cliente obrigatório e "Cadastrar novo cliente"** (conferido no código da MarketUP em 08/11/2026):
- O Salvar só libera com um cliente com ID (`disableSave`). O modo "sem cliente" (`isNoClient`) não aparece nesta tela; é do PDV.
- "Cadastrar novo cliente" (`addClient`) grava o cliente na hora, só com o nome digitado: pessoa física, lista Padrão e limite = "Limite para novos clientes". Depois, CPF/CNPJ, RG/IE, e-mail, telefone e endereço se completam ali mesmo.
- No RDX:
  - o servidor recusa orçamento sem cliente;
  - a tela leva o Salvar até o campo do cliente;
  - `cadastrarCliente` cria o cliente;
  - `DadosCliente` completa a ficha, com "Salvar cliente" aparecendo só quando algo muda;
  - o endereço de faturamento já abre para o cliente novo;
  - o cliente novo recebe o limite dos Parâmetros de venda.

**Impressão / PDF** (`/vendas/orcamentos/{id}/imprimir`), no modelo da impressão da MarketUP (orçamento 826), com os ajustes pedidos pelo usuário em 08/11/2026:
- topo com o logotipo à esquerda e os dados da empresa à direita;
- "Orçamento de venda" (número, cliente, CPF/CNPJ, e-mail, telefone, emissão, entrega, validade);
- **endereço de cobrança e de entrega lado a lado**;
- itens com Referência, Descrição, **Unid.** e **Qtd.** (abreviadas e estreitas, para sobrar espaço na descrição), Unitário, Desconto e Total (sem largura fixa: crescem com o valor, sem quebrar) e a linha **"OBS:"** de cada item, mais a caixa "Quantidade de itens / Valor total dos itens";
- valor total do orçamento, forma/condições de pagamento, observações (comentários; sempre aparece, mesmo vazia), assinaturas do comprador e do recebedor e "Impresso em";
- a folha ocupa a página A4 inteira: depois dos itens fica um espaço que empurra o fecho (totais, pagamento, observações, assinaturas) para o pé da folha; os itens vão tomando esse espaço e, se não couberem, passam para a página seguinte, com o fecho junto no final.

**Pagamento** (lido no código da MarketUP em 08/11/2026: `setPayment`, `calcPaymentBalance`, `removePayment`, `validateInformations`):
- "Total a pagar" é o saldo (total − parcelas). O campo Valor vem com o saldo.
- "Gerar contas":
  - valor acima do saldo → "O valor do recebimento excede o valor a receber"; zero → "não pode ser 0";
  - cada parcela = valor ÷ n arredondado, e a diferença vai para a 1ª (620 em 3x = 206,66 + 206,67 + 206,67);
  - 1ª parcela = **hoje** + dias da 1ª parcela, depois + intervalo;
  - depois de gerar, forma e parcelamento voltam ao vazio.
- As parcelas de um "Gerar contas" formam um grupo (`PaymentGuid` → campo `grupo`), com título "FORMA (parcelamento)" e uma lixeira que remove o grupo inteiro.
- Em cada parcela dá para editar vencimento, observação e valor. Se o valor passar do total, a parcela editada é cortada no excesso, com o aviso "O valor digitado ultrapassou do valor total do pedido.".
- Ao salvar, parcelas são opcionais; se existirem, a soma tem de bater com o total.
- Conferido no RDX com o mesmo caso aberto na MarketUP: cheque 03x (30, 90 e 150 dias), mesmos valores e datas.
- Pendente: a MarketUP exige CPF/CNPJ e e-mail do cliente para BOLETO quando há emissor de boleto configurado; o RDX ainda não emite boleto.

**Comentários do orçamento**: o balão no topo do quadro "Orçamento" é o mesmo balão flutuante da observação do item, com título "COMENTÁRIOS", sem limite de caracteres e só com o botão SALVAR. No RDX, usa `BalaoEdicao` com `semCancelar`. No orçamento já gravado, o Salvar grava só os comentários na hora (`PATCH`); no orçamento novo, o texto vai junto com o Salvar da ficha. O ícone fica na cor principal quando há comentário, e o texto aparece ao passar o mouse.

**Venda fracionada (seta embaixo de "QNTD.")**, conferida no código da MarketUP em 08/11/2026 (`setItem`, `unitChange`, `checkWholeSaleValue`):
- A seta é um seletor com as unidades de venda do item: a do produto e, se o produto tem fragmentação com valor > 0, a da fração (ex.: Rolo e Metro).
- Ao escolher o item: quantidade 1, unidade do produto, preço de varejo.
- Trocar para a fração: o item fica fracionado e o unitário vira o valor da fração; voltar usa varejo/atacado.
- Fracionado nunca usa preço de atacado.
- No RDX: `unidadesDoItem` / `precoNaLista` (`resources/orcamentos/preco.ts`), `SeletorUnidade` na faixa de incluir e o mesmo seletor no modal "Desconto no item". O servidor só aceita a unidade do produto ou a da fração e calcula `fragmentado`.
- Nenhum produto da RDX na MarketUP é vendido fracionado hoje; o teste usou um produto descartável (1 rolo = 50 m, R$ 12,00/m).
- A baixa de estoque da fração fica com a T301.

Diferenças que ficam: e-mail do orçamento, "Imprimir etiquetas", assinatura eletrônica (MarketUP Sign, serviço pago deles) e as setas de rolagem dos cartões de endereço.

## Decisões

- Status com os códigos da MarketUP: 1 Novo, 3 Pedido, 4 Cancelado, 6 Concluído. Só orçamento Novo pode ser alterado ou excluído; os outros usam **Copiar**.
- Totais sempre recalculados no servidor; a tela mostra uma prévia com a mesma regra.
- Desconto (geral e por item) em R$ ou %, guardando os dois.
- Preço sugerido: atacado quando a quantidade chega na mínima; aplica a lista de preços do cliente (desconto geral ou do item diferenciado). O vendedor pode alterar o unitário.
- Medidas da rede (ex.: "2,30 x 1,30") vão na observação do item, como a RDX já faz na MarketUP.
- "Gerar contas" gera as parcelas pela condição de pagamento; podem ser várias formas (ex.: parte PIX, parte boleto). Ao salvar, a soma das parcelas tem que bater com o total.
- Prazos padrão de validade e entrega vêm de Ajustes › Parâmetros de venda; o vendedor padrão é o funcionário-vendedor ligado ao usuário logado.
- O "+" de endereço cadastra o endereço na ficha do cliente (precisa de permissão de alterar clientes).

## Pendências

- ~~**Gerar pedido** (T203)~~ feito na T203.
- **Migração:** a exportação da listagem só traz número, status, nome do cliente, datas e total (sem itens nem ID do cliente). Os 3.872 orçamentos dependem da base completa (M002). A exportação também não traz os IDs dos endereços que os orçamentos usam.
- **IDs:** até a carga, um orçamento criado no RDX recebe o nº 1, que existe na MarketUP. Não fazer orçamentos reais no RDX antes da carga.

## Dúvidas

- ~~Limite de crédito dos clientes importados~~: resolvido em 08/11/2026. Vale o "Limite para novos clientes" de Ajustes › Parâmetros de venda (R$ 1.000,00), aplicado na carga a quem está sem limite.
