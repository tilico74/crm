// Tipos da API de clientes (backend/apps/clientes/serializers.py).

export type TipoValor = "R" | "P";

export type ItemListaPreco = {
  id?: number;
  produto: number | null;
  servico: number | null;
  item_descricao?: string;
  desconto_varejo: string;
  desconto_varejo_tipo: TipoValor;
  desconto_atacado: string;
  desconto_atacado_tipo: TipoValor;
};

export type ListaPreco = {
  id: number;
  nome: string;
  desconto_varejo: string;
  desconto_varejo_tipo: TipoValor;
  desconto_atacado: string;
  desconto_atacado_tipo: TipoValor;
  itens: ItemListaPreco[];
};

export type TipoDocumento = { id: number; nome: string };

export type EnderecoCliente = {
  id?: number;
  cep: string;
  exterior: boolean;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ibge: string;
  ativo: boolean;
  padrao: boolean;
};

export type ContatoCliente = { id?: number; nome: string; cargo: string; telefone: string; email: string };

export type DadoBancarioCliente = {
  id?: number;
  banco: number | null;
  banco_nome?: string;
  agencia: string;
  agencia_digito: string;
  conta: string;
  conta_digito: string;
};

export type DocumentoCliente = { id?: number; tipo: number | null; tipo_nome?: string; documento: string; arquivo?: string | null };

export type HistoricoCliente = { id?: number; data: string; descricao: string; status: 1 | 2 };

export type ClienteLinha = {
  id: number;
  nome: string;
  apelido: string;
  tipo_pessoa: "F" | "J";
  lista_preco: number;
  lista_preco_nome: string;
  telefone: string;
  celular: string;
  email: string;
  cpf: string;
  cnpj: string;
  bloqueado: boolean;
};

export type Cliente = {
  id: number;
  tipo_pessoa: "F" | "J";
  lista_preco: number;
  bloqueado: boolean;
  nome: string;
  apelido: string;
  cpf: string;
  rg: string;
  rg_emissor: string;
  rg_uf: string;
  sexo: "" | "M" | "F";
  aniversario: string | null;
  cnpj: string;
  indicador_ie: 1 | 2 | 3;
  inscricao_estadual: string;
  inscricao_municipal: string;
  telefone: string;
  celular: string;
  email: string;
  site: string;
  observacao: string;
  limite_credito: string;
  email_nfe: string;
  iss_retido: boolean;
  consumidor_final: boolean;
  produtor_rural: boolean;
  enderecos: EnderecoCliente[];
  contatos: ContatoCliente[];
  dados_bancarios: DadoBancarioCliente[];
  documentos: DocumentoCliente[];
  historico: HistoricoCliente[];
  credito?: { limite: string; utilizado: string | number; disponivel: string | number };
};

/** Desconto com a unidade escolhida nos botões R$ / % da MarketUP. */
export const formatarDesconto = (valor: string, tipo: TipoValor) =>
  tipo === "P"
    ? `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
    : Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
