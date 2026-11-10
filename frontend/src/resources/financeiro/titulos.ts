// Tipos e textos das telas Contas a receber / Contas a pagar, Movimentação e Fluxo de caixa (T302).

export type Lado = "receber" | "pagar";

export const LADO: Record<Lado, {
  titulo: string; api: string; rota: string; verbo: string; feito: string; pessoa: string; acao: string; quitada: string; aVencer: string;
}> = {
  receber: {
    titulo: "Contas a receber", api: "/contas-receber", rota: "/financeiro/contas-a-receber", verbo: "recebimento", feito: "Recebido",
    pessoa: "Sacado", acao: "Efetuar recebimento", quitada: "Recebido", aVencer: "A receber",
  },
  pagar: {
    titulo: "Contas a pagar", api: "/contas-pagar", rota: "/financeiro/contas-a-pagar", verbo: "pagamento", feito: "Pago",
    pessoa: "Beneficiário", acao: "Efetuar pagamento", quitada: "Pago", aVencer: "A pagar",
  },
};

export const ORIGEM: Record<number, string> = {
  2: "Despesas", 3: "Receitas", 4: "Impostos", 5: "Comissões", 6: "Compras", 7: "Vendas", 8: "PDV", 11: "OS",
};

export type Baixa = {
  id?: number;
  data: string;
  valor: string;
  desconto: string;
  juros: string;
  amortizado?: string;
  tipo_pagamento: number | null;
  tipo_pagamento_nome?: string | null;
  conta_corrente: number | null;
  conta_corrente_nome?: string | null;
  observacao: string;
};

export type Titulo = {
  id: number;
  origem: number;
  origem_nome: string;
  origem_id: number | null;
  manual: boolean;
  conta_gerencial: number | null;
  conta_gerencial_nome: string | null;
  tipo_pagamento: number | null;
  tipo_pagamento_nome: string | null;
  descricao: string;
  documento: string;
  codigo_barras: string;
  observacao: string;
  parcela: number;
  parcelas: number;
  emissao: string;
  vencimento: string;
  valor: string;
  saldo: string;
  cancelada: boolean;
  situacao: string;
  pessoa_nome: string;
  baixas: Baixa[];
  cliente?: number | null;
  funcionario?: number | null;
  fornecedor?: number | null;
  beneficiario_nome?: string;
};

/** Faixa de status da MarketUP (getListEventStatusName), com as cores do design system. */
export function statusTitulo(situacao: string, lado: Lado): { rotulo: string; cor: string; faixa: string } {
  const t = LADO[lado];
  const parcial = situacao.endsWith("_parcial") ? ` / parcialmente ${lado === "receber" ? "recebido" : "pago"}` : "";
  const base = situacao.replace("_parcial", "");
  switch (base) {
    case "quitada":
      return { rotulo: t.quitada, cor: "text-success", faixa: "bg-success text-surface-raised" };
    case "hoje":
      return { rotulo: `Hoje${parcial}`, cor: "text-warning-ink", faixa: "bg-warning text-black" };
    case "a_vencer":
      return { rotulo: `${t.aVencer}${parcial}`, cor: "text-primary", faixa: "bg-primary text-primary-foreground" };
    case "vencida":
      return { rotulo: `Vencida${parcial}`, cor: "text-error", faixa: "bg-error text-surface-raised" };
    case "cancelada":
      return { rotulo: "Cancelada", cor: "text-ink-muted", faixa: "bg-secondary text-surface-raised" };
    default:
      return { rotulo: "Novo", cor: "text-primary", faixa: "bg-primary text-primary-foreground" };
  }
}

/** Link "Ver origem" (getOriginLink da MarketUP), para as origens que existem no RDX. */
export function linkOrigem(t: Pick<Titulo, "origem" | "origem_id">): string | null {
  if (!t.origem_id) return null;
  if (t.origem === 7) return `/vendas/pedidos/${t.origem_id}`;
  if (t.origem === 5) return `/vendas/comissoes/aprovacao/${t.origem_id}`;
  return null;
}
