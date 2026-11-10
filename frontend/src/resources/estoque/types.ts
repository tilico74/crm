// Tipos da API do estoque (backend/apps/estoque/views.py).

export type TipoEstocagem = { id?: number; nome: string; sistema: boolean };
export type Motivo = { id?: number; nome: string };

export type Local = { id: number; nome: string; tipo: number; tipo_nome: string; ativo: boolean; padrao: boolean; sistema: boolean; em_inventario: number | null };

export const TIPO_MOV: Record<number, { rotulo: string; cor: string }> = {
  1: { rotulo: "Entrada", cor: "text-primary" },
  2: { rotulo: "Saída", cor: "text-error" },
  3: { rotulo: "Transferência", cor: "text-ink" },
  4: { rotulo: "Acerto", cor: "text-warning-ink" },
};

export type ItemMov = {
  id?: number;
  produto: number;
  produto_descricao?: string;
  codigo?: string;
  unidade: number | null;
  unidade_sigla?: string | null;
  quantidade: string;
  valor_unitario: string;
  lote: string;
  fabricacao: string | null;
  validade: string | null;
};

export type Movimentacao = {
  id: number;
  tipo: number;
  tipo_nome: string;
  origem: number | null;
  origem_nome: string | null;
  origem_id: number | null;
  data: string;
  local_origem: number | null;
  local_origem_nome: string | null;
  local_destino: number | null;
  local_destino_nome: string | null;
  pessoa: string;
  informacoes: string;
  nota_numero: string;
  nota_serie: string;
  nota_emissao: string | null;
  nota_valor_adicional: string;
  motivo: number | null;
  motivo_nome: string | null;
  perda_avaria: boolean;
  total_quantidade: string;
  total_valor: string;
  manual: boolean;
  itens: ItemMov[];
};

export const ROTA_ESTOQUE = {
  consulta: "/estoque/consulta",
  movimentacoes: "/estoque/movimentacoes",
  locais: "/estoque/locais",
};
