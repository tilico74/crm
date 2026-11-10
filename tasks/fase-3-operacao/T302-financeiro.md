# T302 — Financeiro

| Campo | Valor |
| --- | --- |
| Status | Em revisão |
| Depende de | T203 |
| Skills | `criar-tela-listagem`, `criar-tela-formulario`, `criar-api-modulo` |
| Contexto | `context/marketup/telas-e-entidades.md` (seção "Financeiro (T302)") |

## Objetivo

Contas a pagar e a receber, movimentação de caixa (lançamentos e transferências) e fluxo de caixa, iguais à MarketUP.

## Critérios de aceite

- Títulos em aberto migrados (depende da M002)
- Dinheiro em decimal, nunca float
- Mesmas regras e números da MarketUP (conferidos com os dados da RDX)

## Pesquisa na MarketUP (09/11/2026, só leitura)

Feita a fundo, lendo o código das telas e conferindo com consultas de leitura: enums financeiros, status do título, listagens, filtros, ficha (painel "Efetuar recebimento", regra dos juros, gravação no Salvar), receber várias, movimentação (agrupada por data, saldos, lançamento avulso, transferência), fluxo de caixa (realizado × previsto, saldo projetado com os vencidos, grupos do DRE, cards e simulação) e o plano de contas (58 contas). Tudo em `context/marketup/telas-e-entidades.md`.

## Feito

- [x] **Modelo** (`backend/apps/financeiro/models.py`): `Titulo` (base) → `ContaReceber` / `ContaPagar`; `Baixa` (base) → `Recebimento` / `Pagamento`; `Transferencia`; `LancamentoCaixa` ligado ao título, à transferência e à conta gerencial. Origens com os números da MarketUP (`OrigemFinanceira`: 2 Despesas, 3 Receitas, 5 Comissões, 7 Vendas, 11 OS...). Migração ajusta os dados de teste (origens, estornos antigos).
- [x] **Contas a receber / a pagar** (`recebimentos.py`, `/api/contas-receber` e `/api/contas-pagar`):
  - lista com filtros da MarketUP (vencidas/a vencer, em aberto/quitadas, conta gerencial, tipo de pagamento, vencimento de/até, busca) e totais de valor e saldo;
  - ficha grava título e baixas juntos (`novas_baixas` + `manter_baixas`): o X tira a baixa e o movimento some do caixa, como na MarketUP;
  - amortizado = valor + desconto − juros; mais que o saldo é recusado (a tela oferece a diferença como juros);
  - conta corrente obrigatória; valor/emissão/vencimento travam com baixa; descrição/pessoa travam em título vindo de documento;
  - título manual com repetição (2 a 12 vezes, mensal) e exclusão (só manual, "Cancelar");
  - receber/pagar várias (`baixar-varias`); recibo.
- [x] **Movimentação de caixa** (`caixa.py`, `/api/movimentacao-caixa`, `/api/transferencias`): período (padrão 7 dias), filtros (conta, conta gerencial, forma, tipo, valor), saldo do período e saldo atual; lançamento avulso = título já quitado; transferência = saída + entrada; exclusão de movimento manual.
- [x] **Fluxo de caixa** (`/api/fluxo-caixa`): realizado até hoje e previsto depois (contas em aberto pelo vencimento); saldo inicial de período futuro = saldo hoje − a pagar vencido + a receber vencido + previsto até a véspera (regra conferida: 25.123,51 − 25.478,45 + 14.070,00 = 13.715,06); Receita em Operacionais / Não operacionais, Despesa pelos grupos do DRE, cada um abrindo conta gerencial e títulos; visão por dias ou meses; cards de inadimplência e endividamento; transferências não mexem no consolidado.
- [x] **Plano de contas** carregado com os IDs da MarketUP (`importar_contas_gerenciais`, 58 contas). Contas usadas pelo sistema: 52 Vendas via Pedido, 43 Comissão de Vendas, 5 Devoluções / Abatimentos (estorno de pedido cancelado), 35/54 Transferência.
- [x] **Telas**: Contas a receber e a pagar (lista + ficha + receber/pagar várias), Movimentação de caixa (com os modais Lançamento e Transferência) e Fluxo de caixa (com a simulação 0/15/30/50/75%).
- [x] **Integrações**: no pedido, RECEBER e a lupa abrem a ficha da conta a receber (o modal provisório saiu); na aprovação de comissões, a conta a pagar abre a ficha para pagar.
- [x] Testes: 6 novos no backend (`tests/test_financeiro_titulos.py`), testes do pedido ajustados ao fluxo da ficha; 193 no backend.

## Pendências e diferenças conhecidas

- [x] Teste na tela (09/11/2026, feito pelo Claude no RDX): recebimento parcial (faixa "a receber / parcialmente recebido"), recebimento acima do saldo com a diferença como juros (R$ 1,25), remoção com X + Salvar (saldo voltou), conta a pagar repetida 3x, pagamento de várias, lançamento avulso, transferência (consolidado não muda; Nubank −100,00), fluxo de caixa com previsto (jan −150, fev +28,75) e drill-down, recibo. Corrigidos no teste: sacado vazio ao abrir a ficha, texto do status estourando a faixa, botão vermelho no aviso de juros (ConfirmDialog ganhou `neutro`), descrição antiga dos movimentos de teste.
- [x] Menu igual ao da MarketUP (09/11/2026): Pagamentos (Contas a pagar · Contas pagas) e Recebimentos (Cobrança (Conta a receber) · Contas recebidas), com o atalho "+" e os filtros prontos (em aberto / quitadas, vencimento a partir de 3 meses atrás). Rotas `/financeiro/contas-pagas` e `/financeiro/contas-recebidas`.
- [ ] Conferência do usuário no navegador.
- Card **Endividamento** da MarketUP mostrava R$ 13.065,18 em 5 contas, número que não bateu com nenhum recorte testado (o total vencido era 25.478,45 em 21 contas). No RDX o card usa todas as contas a pagar vencidas em aberto (o mesmo critério do saldo projetado, que bateu).
- Beneficiário da conta a pagar: funcionário (comissão), cliente ou nome livre; fornecedor entra com Compras.
- Recibo por e-mail (botão Enviar): depende da configuração de e-mail.
- Aba Crédito do cliente com as parcelas vencidas / a vencer / pagas: a fazer.
- Migração dos títulos em aberto e do saldo inicial das contas correntes: com a base completa (M002). Até lá, o saldo inicial entra por um lançamento "Ajuste de Caixa - Entrada" (conta 73).
- Exportar e imprimir as listas: a fazer.
