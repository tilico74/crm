// Tipos da API de comissões (backend/apps/comissoes/views.py).

export const ROTA_COMISSOES = "/vendas/comissoes";
export const ROTA_APROVACAO = "/vendas/comissoes/aprovacao";

export type Comissao = {
  id: number;
  tipo: 0 | 1;
  tipo_nome: string;
  vendedor: number;
  vendedor_nome: string;
  pedido: number | null;
  pedido_cliente: string | null;
  emissao: string;
  fechamento: number | null;
  data_fechamento: string | null;
  estorno_de: number | null;
  observacao: string;
  valor_venda: string;
  percentual: string;
  valor: string;
};

export type Vendedor = { id: number; nome: string; comissao: string; bloqueado: boolean };

export type PedidoBusca = { id: number; cliente: string; valor: string; vendedor: number | null; percentual: string };

export type ContaPagarResumo = { id: number; descricao: string; valor: string; saldo: string; vencimento: string; cancelada: boolean; funcionario__nome: string };

export type Fechamento = {
  id: number;
  data: string;
  descricao: string;
  valor_total: string;
  comissoes: Comissao[];
  contas_pagar: ContaPagarResumo[];
};
