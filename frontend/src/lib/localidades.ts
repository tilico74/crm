// Cliente dos endpoints de localidades (context/integracoes/localidades.md).
// Uso nos formulários: skills/preencher-endereco/SKILL.md.

import { api } from "./api";

export type EnderecoCep = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Código IBGE do município (exigido na nota fiscal). */
  ibge: string;
  ddd: string;
};

export type Estado = { id: number; sigla: string; nome: string; regiao: string };
export type Municipio = { id: number; nome: string };

const soDigitos = (cep: string) => cep.replace(/\D/g, "");

/** Endereço pelo CEP. Erros: ApiError 400 (CEP inválido), 404 (não existe), 503 (serviço fora). */
export const consultarCep = (cep: string) => api<EnderecoCep>(`/localidades/cep/${soDigitos(cep)}`);

/** CEPs pela rua ("Não sei o CEP"). Cidade e rua com pelo menos 3 letras. */
export const pesquisarEnderecos = (uf: string, cidade: string, logradouro: string) =>
  api<EnderecoCep[]>(`/localidades/enderecos?${new URLSearchParams({ uf, cidade, logradouro })}`);

export const listarEstados = () => api<Estado[]>("/localidades/estados");

/** Municípios do estado, por nome. Aceita a sigla (SC) ou o código IBGE (42). */
export const listarMunicipios = (uf: string) => api<Municipio[]>(`/localidades/estados/${uf}/municipios`);

/** CEP completo (8 dígitos) para disparar a consulta ao sair do campo. */
export const cepCompleto = (cep: string) => soDigitos(cep).length === 8;

/** Campos do endereço que o CEP preenche (mesmos nomes em todos os modelos do RDX). */
export const camposDoCep = ({ logradouro, bairro, cidade, uf, ibge }: EnderecoCep) => ({ logradouro, bairro, cidade, uf, ibge });
