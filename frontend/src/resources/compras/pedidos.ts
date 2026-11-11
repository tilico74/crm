// Tipos da API de pedidos de compra (backend/apps/compras/pedidos.py).
import type { ItemOrcamento, ParcelaOrcamento } from "@/resources/orcamentos/types";
import type { SituacaoPedido } from "@/resources/pedidos/types";

export const ROTA_PEDIDOS_COMPRA = "/estoque/compras/pedidos";
export const ROTA_DEVOLUCOES_COMPRA = "/estoque/compras/devolucoes";
export const ROTA_COMPRAS_EM_ABERTO = "/estoque/compras/em-aberto";

/** Cores dos status de recebimento e pagamento (design system: verde só para o que está concluído). */
export const COR_STATUS: Record<string, string> = {
  Total: "text-success",
  Entregue: "text-success",
  Pago: "text-success",
  Pendente: "text-warning-ink",
  Parcial: "text-warning-ink",
  "Pago Parcialmente": "text-warning-ink",
  Atrasado: "text-error",
  Cancelado: "text-error",
};

export type ItemCompra = Omit<ItemOrcamento, "fragmentado"> & {
  fragmentado: boolean;
  codigo_fornecedor?: string;
  recebido?: string;
  devolvido?: string;
  data_devolucao?: string | null;
  valor_devolvido?: string;
  lote?: string;
  validade?: string | null;
  custo_atual?: string | null;
  movimenta_estoque?: boolean;
};

export type ParcelaCompra = ParcelaOrcamento & {
  conta_gerencial?: number | null;
  conta_gerencial_nome?: string | null;
  saldo?: string;
  conta_pagar?: number | null;
  ultimo_pagamento?: string | null;
};

export const CAMPOS_ENDERECO = ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "ibge"] as const;
type CampoEndereco = (typeof CAMPOS_ENDERECO)[number];
type Enderecos = { [K in `fat_${CampoEndereco}` | `ent_${CampoEndereco}`]: string };

export type PedidoCompra = Enderecos & {
  id: number;
  status: number;
  fornecedor: number | null;
  fornecedor_nome?: string | null;
  fornecedor_documento?: string | null;
  fornecedor_ie?: string | null;
  fornecedor_email?: string | null;
  fornecedor_telefone?: string | null;
  comprador: number | null;
  comprador_nome?: string | null;
  emissao: string;
  previsao: string | null;
  data_faturamento?: string | null;
  data_cancelamento?: string | null;
  observacao: string;
  sem_endereco_faturamento: boolean;
  sem_endereco_entrega: boolean;
  subtotal?: string;
  desconto: string;
  desconto_percentual: string;
  desconto_em_percentual: boolean;
  frete: string;
  outros_custos: string;
  total?: string;
  conta_gerencial: number | null;
  conta_gerencial_nome?: string | null;
  nota_numero: string;
  nota_serie: string;
  nota_emissao: string | null;
  orcamento_id?: number | null;
  itens: ItemCompra[];
  parcelas: ParcelaCompra[];
  // Calculados (como a MarketUP).
  situacao?: SituacaoPedido;
  recebimento_status?: string;
  pagamento_status?: string;
  recebimento_lista?: string;
  pagamento_lista?: string;
  itens_a_receber?: number;
  saldo_pagar?: string;
  valor_pago?: string;
};

export type PedidoCompraLinha = {
  id: number;
  status: number;
  fornecedor: number;
  fornecedor_nome: string;
  fornecedor_documento: string;
  fornecedor_ie: string;
  emissao: string;
  data_faturamento: string | null;
  previsao: string | null;
  total: string;
  situacao: SituacaoPedido;
  recebimento_lista: string;
  pagamento_lista: string;
  itens_a_receber: number;
};

export type DevolucaoLinha = {
  id: number;
  pedido: number;
  fornecedor_nome: string;
  data: string;
  usuario: string;
  tipo_pagamento_nome: string;
  valor: string;
  valor_estorno: string;
};
