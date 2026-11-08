// Valor em reais por extenso ("Importância por extenso" do recibo da MarketUP).

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0 a 999 por extenso. */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
  }
  return partes.join(" e ");
}

const GRUPOS: [string, string][] = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"]];

/** Inteiro por extenso ("mil e duzentos", "dois milhões e trezentos mil"). */
export function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);
  const partes: { texto: string; valor: number; grupo: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const [singular, plural] = GRUPOS[i];
    const nome = i === 1 && g === 1 ? "mil" : `${ate999(g)}${i ? ` ${g === 1 ? singular : plural}` : ""}`;
    partes.push({ texto: nome, valor: g, grupo: i });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou é centena redonda ("mil e duzentos");
  // vírgula depois de milhão/bilhão ("um milhão, mil e um"); nos outros casos, só espaço ("mil duzentos e cinquenta").
  return partes
    .map((p, i) => {
      if (i === 0) return p.texto;
      const ultimo = i === partes.length - 1;
      if (ultimo && (p.valor < 100 || p.valor % 100 === 0)) return ` e ${p.texto}`;
      return (partes[i - 1].grupo >= 2 ? ", " : " ").concat(p.texto);
    })
    .join("");
}

/** "R$ 3.051,60" → "três mil e cinquenta e um reais e sessenta centavos". */
export function reaisPorExtenso(valor: number | string): string {
  const centavosTotais = Math.round(Number(valor || 0) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  const partes: string[] = [];
  if (reais) {
    const milhaoRedondo = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiroPorExtenso(reais)}${milhaoRedondo ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}
