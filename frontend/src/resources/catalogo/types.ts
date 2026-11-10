// Catálogo (T103): tipos da API /unidades, /marcas, /categorias, /subcategorias, /produtos e /servicos.

export type Unidade = { id?: number; sigla: string; nome: string; sistema: boolean };
export type Marca = { id?: number; nome: string; imagem: string | null };
export type Subcategoria = { id?: number; nome: string; categoria?: number };
export type Categoria = { id: number; nome: string; subcategorias: Subcategoria[] };

export type ItemComposicao = {
  /** Só na tela (TabelaEditavel precisa de uma chave); não vai para a API. */
  id?: number;
  item: number | null;
  item_descricao?: string;
  item_custo?: string;
  quantidade: string;
  unidade: number | null;
  unidade_sigla?: string | null;
};

export type Produto = {
  id: number;
  ativo: boolean;
  codigo_barras: string;
  imagem: string | null;
  descricao: string;
  tipo_item: "produto" | "kit" | "insumo" | "brinde";
  unidade: number | null;
  unidade_sigla?: string;
  codigo_balanca: string;
  categoria: number | null;
  categoria_nome?: string | null;
  subcategoria: number | null;
  subcategoria_nome?: string | null;
  marca: number | null;
  marca_nome?: string | null;
  modelo: string;
  codigo_interno: string;
  tags: string[];
  preco_custo: string;
  preco_venda: string;
  preco_atacado: string;
  quantidade_minima_atacado: string;
  reajustar_pela_margem: boolean;
  movimenta_estoque: boolean;
  movimenta_estoque_composicao: boolean;
  estoque_minimo?: string;
  /** Venda fracionada: 1 <unidade do produto> = quantidade × unidade, a preço cada. Tudo nulo = não fraciona. */
  fragmentacao_quantidade: string | null;
  fragmentacao_unidade: number | null;
  fragmentacao_unidade_sigla?: string | null;
  fragmentacao_preco: string | null;
  tipo_fiscal: string;
  ncm: string;
  origem: number | null;
  cest: string;
  classificacao: string;
  composicao: ItemComposicao[];
};

export type Servico = {
  id: number;
  ativo: boolean;
  codigo_barras: string;
  nome: string;
  preco_custo: string;
  preco_venda: string;
  unidade: number | null;
  unidade_sigla?: string;
  reajustar_pela_margem: boolean;
};

/** Margem de lucro aproximada da MarketUP: (venda − custo) ÷ venda, em %. */
export function margem(custo: string | number, venda: string | number): number {
  const v = Number(venda);
  const c = Number(custo);
  if (!v || !Number.isFinite(v) || !Number.isFinite(c)) return 0;
  return ((v - c) / v) * 100;
}
