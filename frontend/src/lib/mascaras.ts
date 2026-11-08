// Máscaras e formatos de exibição (context/regras-de-negocio/formatos.md).
// No banco os valores ficam LIMPOS; a máscara é só na tela. Mesmas regras em
// backend/apps/core/documentos.py.

export type TipoMascara = "cpf" | "cnpj" | "cpfCnpj" | "rg" | "cep" | "telefone";

const soDigitos = (v: string) => v.replace(/\D/g, "");
const soAlfanumerico = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

/**
 * Aplica um padrão aos caracteres já limpos, até onde houver caracteres
 * (formata enquanto a pessoa digita). No padrão, "#" é qualquer caractere aceito.
 */
function aplicar(limpo: string, padrao: string): string {
  let resultado = "";
  let i = 0;
  for (const p of padrao) {
    if (i >= limpo.length) break;
    if (p === "#") resultado += limpo[i++];
    else resultado += p;
  }
  return resultado;
}

// ---- Limpeza (valor que vai para a API) ----

export function limpar(tipo: TipoMascara, valor: string | null | undefined): string {
  const v = valor ?? "";
  switch (tipo) {
    case "cnpj":
      return soAlfanumerico(v).slice(0, 14);
    case "cpfCnpj": {
      const alfa = soAlfanumerico(v);
      return (/[A-Z]/.test(alfa) ? alfa : soDigitos(v)).slice(0, 14);
    }
    case "rg":
      return v.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 14);
    case "cpf":
      return soDigitos(v).slice(0, 11);
    case "cep":
      return soDigitos(v).slice(0, 8);
    case "telefone":
      return soDigitos(v).slice(0, 11);
  }
}

// ---- Formatação (tela) ----

export const formatarCpf = (v: string | null | undefined) => aplicar(limpar("cpf", v), "###.###.###-##");

/** CNPJ numérico ou alfanumérico (2026): mesmo desenho XX.XXX.XXX/XXXX-00. */
export const formatarCnpj = (v: string | null | undefined) => aplicar(limpar("cnpj", v), "##.###.###/####-##");

/** Até 11 caracteres numéricos é CPF; com letra ou mais de 11 é CNPJ. */
export const formatarCpfCnpj = (v: string | null | undefined) => {
  const limpo = limpar("cpfCnpj", v);
  return limpo.length <= 11 && !/[A-Z]/.test(limpo) ? formatarCpf(limpo) : formatarCnpj(limpo);
};

export const formatarCep = (v: string | null | undefined) => aplicar(limpar("cep", v), "#####-###");

/** (00) 0000-0000 para fixo; (00) 00000-0000 para celular (11 dígitos). */
export const formatarTelefone = (v: string | null | undefined) => {
  const limpo = limpar("telefone", v);
  return aplicar(limpo, limpo.length > 10 ? "(##) #####-####" : "(##) ####-####");
};

/**
 * RG muda de estado para estado. Formata os tamanhos mais comuns e deixa os
 * outros como foram digitados: 9 → 00.000.000-0 (SP e outros), 8 → 0.000.000-0, 7 → 0.000.000 (SC).
 */
export const formatarRg = (v: string | null | undefined) => {
  const limpo = limpar("rg", v);
  if (limpo.length === 9) return aplicar(limpo, "##.###.###-#");
  if (limpo.length === 8) return aplicar(limpo, "#.###.###-#");
  if (limpo.length === 7) return aplicar(limpo, "#.###.###");
  return limpo;
};

const FORMATADORES: Record<TipoMascara, (v: string) => string> = {
  cpf: formatarCpf,
  cnpj: formatarCnpj,
  cpfCnpj: formatarCpfCnpj,
  rg: formatarRg,
  cep: formatarCep,
  telefone: formatarTelefone,
};

export const formatar = (tipo: TipoMascara, valor: string | null | undefined) => FORMATADORES[tipo](valor ?? "");

/** Tamanho máximo do texto já com máscara (para o maxLength do campo). */
export const TAMANHO_MAXIMO: Record<TipoMascara, number> = {
  cpf: 14,
  cnpj: 18,
  cpfCnpj: 18,
  rg: 14,
  cep: 9,
  telefone: 15,
};

/** Teclado do celular: só números onde não há letras. */
export const TECLADO: Record<TipoMascara, "numeric" | "text" | "tel"> = {
  cpf: "numeric",
  cnpj: "text", // CNPJ alfanumérico tem letras
  cpfCnpj: "text",
  rg: "text", // RG pode terminar em X
  cep: "numeric",
  telefone: "tel",
};

// ---- Validação (prévia na tela; o back-end valida de novo) ----

export function cpfValido(cpf: string): boolean {
  const d = limpar("cpf", cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[tamanho])) return false;
  }
  return true;
}

/** CNPJ numérico e alfanumérico: cada caractere vale (código ASCII − 48). */
export function cnpjValido(cnpj: string): boolean {
  const c = limpar("cnpj", cnpj);
  if (c.length !== 14 || !/^\d{2}$/.test(c.slice(12)) || /^(.)\1{13}$/.test(c)) return false;
  const valores = [...c].map((ch) => ch.charCodeAt(0) - 48);
  for (const tamanho of [12, 13]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += valores[i] * (((tamanho - 1 - i) % 8) + 2);
    const resto = soma % 11;
    if ((resto < 2 ? 0 : 11 - resto) !== valores[tamanho]) return false;
  }
  return true;
}

/** Mensagem de erro para mostrar ao sair do campo, ou "" se está certo (ou vazio). */
export function validar(tipo: TipoMascara, valor: string): string {
  const limpo = limpar(tipo, valor);
  if (!limpo) return "";
  switch (tipo) {
    case "cpf":
      return cpfValido(limpo) ? "" : "CPF inválido. Confira os 11 dígitos.";
    case "cnpj":
      return cnpjValido(limpo) ? "" : "CNPJ inválido. Confira os 14 caracteres (os 2 últimos são números).";
    case "cpfCnpj":
      return limpo.length <= 11 ? validar("cpf", limpo) : validar("cnpj", limpo);
    case "cep":
      return limpo.length === 8 ? "" : "CEP inválido. Confira os 8 dígitos.";
    case "telefone":
      return limpo.length >= 10 ? "" : "Telefone incompleto. Use DDD + número.";
    case "rg":
      return "";
  }
}

// ---- Outros formatos de exibição (AGENTS.md: R$ 1.234,56 e DD/MM/AAAA na tela) ----

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1234.5" (API) → "R$ 1.234,50". */
export const formatarMoeda = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : MOEDA.format(Number(v));

/** "5.00" → "5,00%". */
export const formatarPercentual = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : `${NUMERO.format(Number(v))}%`;

/** "2026-11-07" ou ISO com hora → "07/11/2026". */
export const formatarData = (v: string | null | undefined) => {
  if (!v) return "";
  const [ano, mes, dia] = v.slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : v;
};
