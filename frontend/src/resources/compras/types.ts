// Tipos da API de compras (backend/apps/compras/serializers.py).

import type { ContatoCliente, DadoBancarioCliente, DocumentoCliente, EnderecoCliente } from "@/resources/clientes/types";

export const ROTA_FORNECEDORES = "/estoque/compras/fornecedores";
export const ROTA_TIPOS_FORNECEDOR = "/ajustes/tipos-de-fornecedor";

export type TipoFornecedor = { id?: number; nome: string };

export type EnderecoFornecedor = EnderecoCliente;
export type ContatoFornecedor = ContatoCliente;
export type DadoBancarioFornecedor = DadoBancarioCliente;
export type DocumentoFornecedor = DocumentoCliente;

/** PixTypeList da MarketUP. */
export const TIPOS_PIX = [
  { value: 1, label: "CPF" },
  { value: 2, label: "CNPJ" },
  { value: 3, label: "Email" },
  { value: 4, label: "Celular" },
  { value: 5, label: "Chave aleatória" },
] as const;

export type ChavePixFornecedor = { id?: number; tipo: number | null; tipo_nome?: string; chave: string };

export type ContaDoFornecedor = {
  id: number;
  descricao: string;
  vencimento: string;
  valor: string;
  saldo: string;
  situacao: "vencida" | "a_vencer" | "paga";
};

export type FornecedorLinha = {
  id: number;
  nome: string;
  apelido: string;
  tipo_pessoa: "F" | "J";
  tipo: number;
  tipo_nome: string;
  telefone: string;
  celular: string;
  email: string;
  cpf: string;
  cnpj: string;
  inscricao_estadual: string;
  bloqueado: boolean;
  transportadora: boolean;
};

export type Fornecedor = {
  id: number;
  tipo_pessoa: "F" | "J";
  tipo: number;
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
  indicador_ie: 1 | 2 | 3 | null;
  inscricao_estadual: string;
  inscricao_municipal: string;
  telefone: string;
  celular: string;
  email: string;
  site: string;
  email_nfe: string;
  observacao: string;
  transportadora: boolean;
  produtor_rural: boolean;
  enderecos: EnderecoFornecedor[];
  contatos: ContatoFornecedor[];
  dados_bancarios: DadoBancarioFornecedor[];
  chaves_pix: ChavePixFornecedor[];
  documentos: DocumentoFornecedor[];
  financeiro?: { totais: { vencidas: string | number; a_vencer: string | number; pagas: string | number }; contas: ContaDoFornecedor[] } | null;
};
