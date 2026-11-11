# T301 — Estoque e Compras

| Campo | Valor |
| --- | --- |
| Status | Em andamento |
| Depende de | T103, T203, T302 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario`, `criar-api-modulo` |
| Contexto | `context/marketup/telas-e-entidades.md` (seção "Estoque e Compras (T301)") |

## Objetivo

O menu Estoque da MarketUP inteiro, com Compras dentro dele: locais, tipos de estocagem, motivos, saldo por local, movimentações, consulta, inventário, fornecedores, orçamentos e pedidos de compra (receber, devolver, cancelar, importar XML), devoluções e compras em aberto. Pedido de venda integrado (entregar baixa o estoque).

## Pesquisa na MarketUP (09/11/2026, só leitura)

Feita: todas as telas do menu Estoque e Compras, enums, regras do pedido de compra (concluir, receber, devolver, cancelar, XML), movimentação manual, consulta, inventário, fornecedor. Detalhes em `context/marketup/telas-e-entidades.md`.

**Uso real:** a RDX nunca usou estoque na MarketUP (0 movimentações; nenhum produto "movimenta estoque"). Compras é usado (~260 pedidos, centenas de fornecedores).

## Etapas

- [x] **1. Estoque** (feita e testada em tela 09/11/2026 — ver "Testes em tela"): tipos de estocagem (1 Padrão, 2 Refrigerado), locais (1 Estoque Padrão), motivos; saldo por produto e local; movimentações manuais (entrada, saída com motivo/perda e avaria, transferência) e automáticas (pedido de venda, compra, cancelamentos, devoluções); consulta de estoque com ajuste; inventário (bloqueia o local, fecha com acerto); estoque mínimo no produto; pedido de venda: Entregar baixa o estoque dos produtos que movimentam estoque, cancelar/devolver devolve.
- [x] **2. Fornecedores** (feita e testada em tela 09/11/2026, carga feita): cadastro igual ao do cliente (tipo, transportadora, produtor rural, abas) + carga com os IDs da MarketUP.
  - Feito: app `compras` (TipoFornecedor 1–5, Fornecedor, endereços, contatos, contas bancárias, **chaves Pix**, documentos); API `/fornecedores`, `/tipos-fornecedor`; funcionalidades fornecedores, tipos_fornecedor, orcamentos_compra, pedidos_compra, devolucoes_compra (só Administrador nasce com acesso); menu Estoque › Compras › Fornecedores e Ajustes › Pessoas › Tipos de fornecedor.
  - Conta a pagar ganhou `fornecedor`; o Beneficiário virou busca de fornecedor, cliente ou funcionário (como a MarketUP), um só por conta.
  - Ficha: confirmação ao trocar física/jurídica, aba Dados bancários com conta ou chave Pix, aba Financeiro (totais, Vencidas/A vencer/Pagas, "Pagar selecionados": 1 abre a conta, várias vão para pagar várias). O botão da MarketUP diz "Receber selecionados"; aqui ficou "Pagar selecionados".
  - Testado em tela: criar fornecedor (CEP, chave Pix), conta a pagar com o fornecedor pela busca, aba Financeiro e o botão de pagar.
  - **Carga (09/11/2026)**: 27 fornecedores com o SupplierID, 20 endereços (`importar_fornecedores`, fonte `migracao/dados/FornecedoresMarketUP.json`). A exportação ListaFornecedores.xls (baixada com autorização do usuário) não tem ID, tipo nem bloqueado; por isso os dados vieram da ficha de cada fornecedor (personSupplierGet, só leitura). Conferido: os 27 nomes e CNPJs batem com a exportação. Nenhum tem contato, conta, Pix ou documento na MarketUP. 4 são pessoa física (45, 2996, 3219 "adis", 3220 "casa").
- [x] **3. Pedido de compra** (concluída em 10/11/2026: tela aprovada pelo usuário comparando o 260): ficha espelhada do pedido de venda (comprador, fornecedor, endereços da empresa, itens com custo, pagamento com conta gerencial 58), concluir (contas a pagar, origem 6 Compras), receber (entrada no estoque, parcial), devolver, cancelar, importar XML da NF-e, impressão.
  - **Pesquisa feita em 09/11/2026** (só leitura): o código da tela inteira (salvar, totais, parcelas, concluir, status da ficha e da lista, receber, devolver/trocar, cancelar), registrado em `context/marketup/telas-e-entidades.md` › "Código da tela lido em 09/11/2026".
  - **Dados reais para a migração**: 260 pedidos (IDs 1–260): 252 faturados e 8 cancelados, nenhum Novo; 604 itens, **todos recebidos por inteiro**, nenhum devolvido, nenhum movimentou estoque (InStock falso), sem serviço, grade, lote ou código do fornecedor; 491 parcelas, 490 com conta gerencial 58 (1 com 0), formas 1, 3, 4 (372), 5, 7, 8, 11 e 12; 14 parcelas sem EventID (conta a pagar); 93 pedidos sem comprador, 167 com o 1142; 7 pedidos com dados de NF; 18 com outros custos, 19 com frete, 105 com desconto geral; nenhum veio de orçamento nem de XML.
  - **Endereços do pedido são cópias** (não apontam para cadastro): faturamento e entrega da própria empresa (Rua José Pedro Correia Filho, 634, Palhoça), alguns com outro local (ex.: pedido 1 entrega em Florianópolis; pedido 50 fatura na BR-101 km 206, São José). No RDX: campos de endereço no próprio pedido, preenchidos com os endereços da empresa (faturamento / entregas).
  - **Projeto decidido** (falta construir):
    - `PedidoCompra` (ID = PurchaseOrderID; status 1 Novo, 2 Faturado, 6 Finalizado, 7 Cancelado; fornecedor; comprador = funcionário; emissão; previsão de recebimento; faturado/cancelado em; endereços copiados; subtotal, desconto geral (R$/%), frete, outros custos, total; conta gerencial 58; NF nº/série/emissão; orçamento de compra de origem).
    - `ItemPedidoCompra` (ID = PurchaseOrderItemID; recebido, devolvido, valor devolvido; lote, validade; código do fornecedor).
    - `ParcelaPedidoCompra` (ID = PurchaseOrderInstallmentID; descrição = duplicata; grupo = PaymentGuid; forma −1 "IMPORTADO XML" vira vazia).
    - `ContaPagar.parcela_compra` (como `ContaReceber.parcela_pedido`), origem 6, "Pedido de Compra Nº X".
    - Recebimento = movimentação de estoque origem 4 (já tem NF, lote e validade).
    - `DevolucaoCompra` + itens (devolver/trocar; serve a lista Devoluções da etapa 4): o valor devolvido abate o saldo em aberto (baixa com desconto, sem caixa) e o excedente volta como estorno no caixa.
    - Cancelar: contas a pagar canceladas, estorno do que já foi pago, itens recebidos saem do estoque (origem 10).
    - Concluir: pergunta se atualiza o custo dos produtos quando o valor ≠ custo (RDX usa PEPS, então pergunta).
    - Status: ficha (Faturado/Concluído; Recebimento e Pagamento Total/Atrasado/Pendente/Parcial) e lista (sem "parcial" no recebimento, sem "atrasado" no pagamento), como a MarketUP.
  - **Feito em 10/11/2026**:
    - Backend `apps/compras`: `PedidoCompra`, `ItemPedidoCompra`, `ParcelaPedidoCompra` (com `evento_marketup`, `saldo_marketup` e `pago_em_marketup` para a carga), `DevolucaoCompra` + itens; `ContaPagar.parcela_compra`.
    - API `/pedidos-compra`: novo, compradores, gerar-parcelas (com conta gerencial), custos, concluir (com `atualizar_custo`), receber, devolver, cancelamento, cancelar, copiar, devoluções; filtros Status, Fornecedor, datas, Produtos, Valor e `a_receber`.
    - Testes: `tests/test_pedidos_compra.py` (6). Backend 211 passando.
    - Frontend: lista (`/estoque/compras/pedidos`), ficha com modais Receber, Devolução/Troca, Cancelar e "Deseja atualizar o preço de custo…", Compras em aberto (`/estoque/compras/em-aberto`); menu Estoque › Compras com Pedidos. A ficha reaproveita as peças da ficha de venda (itens, totais, pagamento), agora exportadas.
    - Decisão: o estorno de devolução e de cancelamento **entra** no caixa (o fornecedor devolve) na conta gerencial do pedido (58), como crédito; a devolução primeiro abate o saldo em aberto das contas a pagar (da última para a primeira) e só o excedente vira estorno.
  - **Carga feita em 10/11/2026** (download autorizado pelo usuário): `migracao/dados/PedidosCompraMarketUP.json` → `importar_pedidos_compra`: 260 pedidos, 604 itens, 491 parcelas, sem estoque. Conferência com a lista da MarketUP: mesma distribuição e os mesmos pedidos (245 concluídos/pagos, 4 pagos parcialmente — 245, 248, 250, 258 —, 3 pendentes — 255, 259, 260 —, 8 cancelados). Pedido 260: Faturado, Recebimento Total, Pagamento Atrasado, saldo R$ 8.721,43, igual à ficha da MarketUP.
  - **Ficha refeita igual à da MarketUP (10/11/2026, a pedido do usuário, comparando 260 lado a lado e o pedido novo da MarketUP sem salvar):**
    - Topo: listar · imprimir · e-mail (desligado até a configuração de e-mail) · copiar · Adicionar novo.
    - Faixa do pedido: status com "Recebimento: X / Pagamento: Y"; comprador e datas como texto (com calendário no pedido novo); botões CONCLUIR + RECEBER (novo) ou RECEBER + DEVOLVER (concluído). Recebimento previsto padrão = hoje + 7 dias (como a MarketUP).
    - Fornecedor: faixa cinza grande; busca "(CNPJ) RAZÃO SOCIAL (FANTASIA)"; "Cadastrar novo fornecedor"; textos-guia "Identificando o fornecedor", "Endereço de Faturamento / Cobrança … CLIQUE AQUI PARA INFORMAR O ENDEREÇO DEPOIS" e "Adicionando itens para compra"; as seções aparecem passo a passo.
    - Endereços: no pedido novo, cartões com os endereços da empresa (o escolhido destacado com lápis; "+" para outro); a entrega vem igual ao faturamento. Concluído: faixa larga com o CEP grande e o botão "Etiqueta".
    - Itens: quantidade "02 UN" e coluna "Entrega" (100% realizada / % pendente).
    - Pagamento: no novo, "Conta gerencial" no painel junto da forma e do parcelamento (só parcelamentos de compras); concluído, cabeçalho com "Valor pendente de pagamento", grupos "PIX (À VISTA)", valor e saldo em caixas e PAGAR.
    - Rodapé na ordem da MarketUP: CANCELAR · CONCLUIR COMPRA · SALVAR · SALVAR E VOLTAR (novo) e CANCELAR · DEVOLVER · RECEBER (concluído).
    - Impressão do pedido (`/estoque/compras/pedidos/:id/imprimir`), no modelo da impressão da venda.
    - Modais rolam em telas baixas (componente Modal comum).
  - **Compradores**: na MarketUP são Esther (2) e Nelson (1142) (`buyerList`, só leitura) → `importar_compradores CompradoresMarketUP.json` liga o "Comprador?".
  - **Teste em tela (10/11/2026)**: pedido 261 (Equipesca): fornecedor → endereço → item pelo custo → conta gerencial 58, PIX à vista, duplicata 9001/001 → Concluir compra perguntou o custo (17,86 → 18,50, Sim) → Receber 6 de 10 com NF 9001/1 (Recebimento PARCIAL, Entrega 60%) → Devolver 2 (R$ 37,00 abatidos: saldo 185 → 148) → impressão. Tudo OK. O 261 ficou no banco de teste.
  - **Falta**: só a etapa 4 (Orçamento de compra, lista de Devoluções); a importação de XML da NF-e fica para quando o usuário enviar um XML de exemplo.
- [ ] **4. Orçamento de compra, Devoluções e Compras em aberto.**

## Testes em tela — etapa 1 (09/11/2026)

Feitos no RDX (banco de teste), produto 1 com "movimenta estoque" e estoque mínimo 5:

| Teste | Resultado |
| --- | --- |
| Entrada 20 com lote | OK; consulta 20 FD, R$ 48.720,00 |
| Saída 25 com motivo criado no "+" e perda e avaria | OK; saldo −5 em vermelho (abaixo do mínimo). Saída manual pode deixar negativo, como na MarketUP (o formulário dela só exige quantidade > 0; o bloqueio de negativo é só da venda) |
| Ajuste pela consulta (−5 → 30) | OK; acerto +35 |
| Transferência com origem = destino | Mensagem da MarketUP "O estoque de origem não pode ser igual ao estoque de destino." |
| Transferência 8 para "Galpão Obra" | OK |
| Inventário no Galpão Obra | Confirmação; saída no local bloqueada durante o inventário; contado 6 → acerto −2; local liberado |
| Pedido de venda 4 › Entregar escolhendo o Galpão Obra | OK; saída origem "Pedido de venda Nº 4" no local escolhido |

Corrigido durante o teste:

- Cabeçalhos Valor/Lote colados (form e consulta da movimentação).
- O form mostrava "Confira os campos destacados" sem destacar nada: agora mostra a mensagem do servidor.
- Acerto da consulta e do inventário saíam com valor R$ 0,00: agora valem pelo custo do produto.
- Saída/entrada do pedido de venda usavam o preço de venda: agora usam o custo, como a movimentação manual da MarketUP (`ItemValue = item.Cost`, com o preço de venda comentado no código dela). Sem movimentos automáticos na MarketUP da RDX para comparar.
- Inventário concluído mostrava o saldo de agora (diferença 0): agora mostra a fotografia da contagem; contado só leitura.
- Tirar item da lista agora pede "Deseja realmente excluir o registro?", como na MarketUP.

## Dúvidas

- Produção fica fora (escopo).
