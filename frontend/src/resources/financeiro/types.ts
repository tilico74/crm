// Ajustes › Financeiro (T106): tipos da API /contas-gerenciais, /contas-correntes,
// /bancos e /tipos-pagamento.

export type ContaGerencial = {
  id: number;
  tipo: "S" | "E";
  tipo_nome?: string;
  conta_origem: number | null;
  conta_origem_nome?: string | null;
  posicao_relativa: number;
  codigo_referencia: string;
  classificacao_dre: string;
  classificacao_dre_nome?: string;
  nome: string;
  cc_debito: string;
  cc_credito: string;
  compras: boolean;
  ativo: boolean;
  sistema: boolean;
};

export type Banco = { id: number; codigo: string; nome: string };

export type ContaCorrente = {
  id: number;
  nome: string;
  interna: boolean;
  banco: number | null;
  banco_nome?: string | null;
  agencia: string;
  agencia_digito: string;
  conta: string;
  conta_digito: string;
  principal: boolean;
  ativo: boolean;
};

export type CondicaoPagamento = {
  id?: number;
  descricao: string;
  parcelas: number;
  intervalo: number;
  primeira_parcela: number;
  percentual_adm: string;
  percentual_antecipacao: string;
  valor_fixo: string;
  classificacao: string;
  compras: boolean;
  vendas: boolean;
};

export type TipoPagamento = {
  id: number;
  descricao: string;
  inicio_contrato: string | null;
  fim_contrato: string | null;
  carencia: number;
  ativo: boolean;
  condicoes: CondicaoPagamento[];
};
