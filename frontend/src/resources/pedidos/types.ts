// Tipos da API de pedidos (backend/apps/vendas/serializers.py) e das contas a receber (financeiro/recebimentos.py).
import type { ItemOrcamento, Orcamento, ParcelaOrcamento } from "@/resources/orcamentos/types";

/** Rótulo da faixa de status, calculado como a MarketUP (getStatusClass): Concluído = faturado, entregue e pago. */
export type SituacaoPedido = "novo" | "faturado" | "concluido" | "cancelado";

/** Cores do design system (verde = success só para Concluído, que é status). */
export const SITUACAO: Record<SituacaoPedido, { rotulo: string; cor: string; fundo: string; borda: string }> = {
  novo: { rotulo: "Novo", cor: "text-primary", fundo: "bg-primary text-primary-foreground", borda: "border-primary" },
  faturado: { rotulo: "Faturado", cor: "text-warning-ink", fundo: "bg-warning text-black", borda: "border-warning" },
  concluido: { rotulo: "Concluído", cor: "text-success", fundo: "bg-success text-surface-raised", borda: "border-success" },
  cancelado: { rotulo: "Cancelado", cor: "text-error", fundo: "bg-error text-surface-raised", borda: "border-error" },
};

/** SaleOrderStatusDeliveryEnum da MarketUP. */
export const ENTREGA: Record<number, { rotulo: string; cor: string }> = {
  1: { rotulo: "Pendente", cor: "text-warning-ink" },
  2: { rotulo: "Entregue", cor: "text-success" },
  3: { rotulo: "Entregue parcialmente", cor: "text-warning-ink" },
  4: { rotulo: "Atrasado", cor: "text-error" },
  5: { rotulo: "Devolução parcial", cor: "text-warning-ink" },
  6: { rotulo: "Devolvido", cor: "text-ink-muted" },
  7: { rotulo: "Cancelado", cor: "text-error" },
};

/** SaleOrderStatusFinancialEnum da MarketUP. */
export const FINANCEIRO: Record<number, { rotulo: string; cor: string }> = {
  1: { rotulo: "Pendente", cor: "text-warning-ink" },
  2: { rotulo: "Pago", cor: "text-success" },
  3: { rotulo: "Pago parcialmente", cor: "text-warning-ink" },
  4: { rotulo: "Atrasado", cor: "text-error" },
  6: { rotulo: "Devolvido", cor: "text-ink-muted" },
  7: { rotulo: "Cancelado", cor: "text-error" },
};

export type ItemPedido = ItemOrcamento & { entregue?: string };

export type ParcelaPedido = ParcelaOrcamento & {
  saldo?: string;
  conta_receber?: number | null;
  ultimo_recebimento?: string | null;
};

/** Campos que o pedido tem a mais que o orçamento. */
export type ExtrasPedido = {
  orcamento: number | null;
  situacao: SituacaoPedido;
  entrega_status: number;
  financeiro_status: number;
  a_entregar: string;
  saldo_receber: string;
  data_faturamento: string | null;
  data_entregue: string | null;
};

export type Pedido = Omit<Orcamento, "status" | "validade" | "data_pedido" | "pedido_id" | "itens" | "parcelas"> &
  ExtrasPedido & { status: number; itens: ItemPedido[]; parcelas: ParcelaPedido[] };

export type PedidoLinha = {
  id: number;
  status: number;
  cliente: number | null;
  cliente_nome: string | null;
  emissao: string;
  data_faturamento: string | null;
  entrega: string | null;
  total: string;
  orcamento: number | null;
  situacao: SituacaoPedido;
  entrega_status: number;
  financeiro_status: number;
};

export type Recebimento = {
  id: number;
  data: string;
  valor: string;
  desconto: string;
  juros: string;
  tipo_pagamento: number | null;
  tipo_pagamento_nome: string | null;
  conta_corrente: number | null;
  conta_corrente_nome: string | null;
  estornado_em: string | null;
};

export type ContaReceber = {
  id: number;
  descricao: string;
  cliente_nome: string | null;
  parcela: number;
  parcelas: number;
  emissao: string;
  vencimento: string;
  valor: string;
  saldo: string;
  cancelada: boolean;
  situacao: "aberta" | "vencida" | "parcial" | "recebida" | "cancelada";
  tipo_pagamento: number | null;
  recebimentos: Recebimento[];
};

export type Recibo = {
  conta: number;
  recebi_de: string;
  documento: string;
  email: string;
  formas: string[];
  vencimento: string;
  parcela: string;
  numero: number;
  data: string | null;
  subtotal: string;
  juros: string;
  desconto: string;
  total: string;
  referente: string;
  assinatura: string;
};

export const ROTA_PEDIDOS = "/vendas/pedidos";
