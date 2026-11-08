// Regras de tela do Ajustes › Financeiro, separadas dos componentes para testar.

/** Classificação DRE da MarketUP, na ordem da tela: primeiro as saídas, depois as entradas. */
export const DRE_SAIDAS = [
  { value: "aluguel", label: "Aluguel, condomínio e IPTU" },
  { value: "custo_mercadoria", label: "Custo da mercadoria" },
  { value: "despesas_financeiras", label: "Despesas financeiras" },
  { value: "gerais_administrativas", label: "Gerais e administrativas" },
  { value: "impostos_devolucoes", label: "Impostos e devoluções" },
  { value: "pessoal", label: "Pessoal" },
  { value: "pro_labore", label: "Pro labore" },
  { value: "propaganda_marketing", label: "Propaganda e marketing" },
  { value: "utilidades", label: "Utilidades" },
];

export const DRE_ENTRADAS = [
  { value: "receitas_financeiras", label: "Receitas financeiras" },
  { value: "entradas", label: "Entradas" },
];

/** Opções de DRE do tipo da conta (Saída ou Entrada). */
export const opcoesDre = (tipo: "S" | "E") => (tipo === "E" ? DRE_ENTRADAS : DRE_SAIDAS);

export const simNao = (v: boolean) => (v ? "Sim" : "Não");

/** "1234" + "5" → "1234-5"; sem dígito, só o número. */
export const comDigito = (numero: string, digito: string) => (numero ? (digito ? `${numero}-${digito}` : numero) : "—");

/** Decimal da API ("1234.5") em formato brasileiro ("1.234,50"). */
export function decimalBr(valor: string | number, casas = 2) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Data ISO da API ("2026-11-07") na tela ("07/11/2026"). */
export const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
