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
- [ ] **3. Pedido de compra**: ficha espelhada do pedido de venda (comprador, fornecedor, endereços da empresa, itens com custo, pagamento com conta gerencial 58), concluir (contas a pagar, origem 6 Compras), receber (entrada no estoque, parcial), devolver, cancelar, importar XML da NF-e, impressão.
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
