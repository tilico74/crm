// Tipos da API de orçamentos (backend/apps/vendas/serializers.py).

export type StatusOrcamento = 1 | 3 | 4 | 6;

/** Status da MarketUP com as cores do design system (verde = success só para Concluído, que é status). */
export const STATUS: Record<StatusOrcamento, { rotulo: string; cor: string; fundo: string; borda: string }> = {
  1: { rotulo: "Novo", cor: "text-primary", fundo: "bg-primary text-primary-foreground", borda: "border-primary" },
  3: { rotulo: "Pedido", cor: "text-warning-ink", fundo: "bg-warning text-black", borda: "border-warning" },
  4: { rotulo: "Cancelado", cor: "text-error", fundo: "bg-error text-surface-raised", borda: "border-error" },
  6: { rotulo: "Concluído", cor: "text-success", fundo: "bg-success text-surface-raised", borda: "border-success" },
};

export type ItemOrcamento = {
  id?: number;
  produto: number | null;
  servico: number | null;
  descricao: string;
  codigo_barras?: string;
  unidade: number | null;
  unidade_sigla?: string | null;
  quantidade: string;
  valor_unitario: string;
  desconto: string;
  desconto_percentual: string;
  desconto_em_percentual: boolean;
  subtotal?: string;
  total?: string;
  fragmentado: boolean;
  observacao: string;
  ordem?: number;
};

export type ParcelaOrcamento = {
  id?: number;
  numero: number;
  quantidade: number;
  vencimento: string;
  valor: string;
  descricao: string;
  /** Parcelas do mesmo "Gerar contas" (PaymentGuid da MarketUP). */
  grupo?: string;
  tipo_pagamento: number;
  tipo_pagamento_nome?: string;
  condicao_pagamento: number | null;
  condicao_pagamento_nome?: string | null;
};

export type OrcamentoLinha = {
  id: number;
  status: StatusOrcamento;
  cliente: number | null;
  cliente_nome: string | null;
  emissao: string;
  validade: string | null;
  entrega: string | null;
  data_pedido: string | null;
  total: string;
  pedido_id: number | null;
};

export type Orcamento = {
  id: number;
  status: StatusOrcamento;
  cliente: number | null;
  cliente_nome?: string | null;
  endereco_faturamento: number | null;
  endereco_entrega: number | null;
  vendedor: number | null;
  vendedor_nome?: string | null;
  emissao: string;
  validade: string | null;
  entrega: string | null;
  data_pedido?: string | null;
  data_cancelamento?: string | null;
  observacao: string;
  subtotal?: string;
  desconto: string;
  desconto_percentual: string;
  desconto_em_percentual: boolean;
  frete: string;
  outros_custos: string;
  total?: string;
  pedido_id?: number | null;
  itens: ItemOrcamento[];
  parcelas: ParcelaOrcamento[];
};

const CENTAVO = 100;
const arredondar = (v: number) => Math.round((v + Number.EPSILON) * CENTAVO) / CENTAVO;

/** Prévia dos totais na tela (mesma regra de backend/apps/vendas/calculo.py; o servidor recalcula ao salvar). */
export function totalItem(i: Pick<ItemOrcamento, "quantidade" | "valor_unitario" | "desconto" | "desconto_percentual" | "desconto_em_percentual">) {
  const subtotal = arredondar(Number(i.quantidade || 0) * Number(i.valor_unitario || 0));
  const desconto = i.desconto_em_percentual ? arredondar((subtotal * Number(i.desconto_percentual || 0)) / 100) : arredondar(Number(i.desconto || 0));
  return { subtotal, desconto, total: arredondar(subtotal - desconto) };
}

export function totaisOrcamento(o: Pick<Orcamento, "itens" | "desconto" | "desconto_percentual" | "desconto_em_percentual" | "frete" | "outros_custos">) {
  const subtotal = arredondar(o.itens.reduce((s, i) => s + totalItem(i).total, 0));
  const desconto = o.desconto_em_percentual ? arredondar((subtotal * Number(o.desconto_percentual || 0)) / 100) : arredondar(Number(o.desconto || 0));
  const total = arredondar(subtotal - desconto + Number(o.frete || 0) + Number(o.outros_custos || 0));
  return { subtotal, desconto, total };
}
