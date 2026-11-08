// Padronização de nomes próprios e endereços (skills/normalizar-nomes/SKILL.md).
// No front-end serve só de prévia; quem grava é backend/apps/core/normalizacao.py.
// As listas espelham skills/normalizar-nomes/casos.json; os testes garantem que continuam iguais.

export const PARTICULAS = new Set(
  "a as com da das de del della di do dos du e em na nas no nos o os para por van von y".split(" "),
);
export const SIGLAS = new Set([
  "CIA", "CNPJ", "CPF", "EIRELI", "EPI", "EPP", "LTDA", "ME", "MEI", "ONG", "RDX", "S.A.", "S/A", "SA",
]);
export const ROMANOS = new Set("I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX".split(" "));

const RODOVIA = /^\p{L}+-\d+$/u;
const PONTUACAO_FINAL = /[,;]+$/;

const LETRA = /\p{L}/u;

// Primeira letra maiúscula (não o primeiro caractere: "7a" -> "7A"); depois de "-" ou "'" a próxima também.
function capitalize(word: string): string {
  let result = "";
  let upperNext = true;
  for (const char of word) {
    if (LETRA.test(char)) {
      result += upperNext ? char.toUpperCase() : char.toLowerCase();
      upperNext = false;
    } else {
      result += char;
      upperNext = upperNext || char === "-" || char === "'";
    }
  }
  return result;
}

function normalizeWord(word: string, index: number, last: number, siglas: Set<string>): string {
  const upper = word.toUpperCase();
  if (RODOVIA.test(word) || siglas.has(upper)) return upper;
  const lower = word.toLowerCase();
  if (index > 0 && ROMANOS.has(upper)) return upper;
  if (index > 0 && index < last && PARTICULAS.has(lower)) return lower;
  if (index > 0 && lower.startsWith("d'")) return "d'" + capitalize(word.slice(2));
  return capitalize(word);
}

export function normalizarNome(texto: string, siglas?: Set<string>): string;
export function normalizarNome(texto: string | null, siglas?: Set<string>): string | null;
export function normalizarNome(texto: string | null, siglas: Set<string> = SIGLAS): string | null {
  if (texto === null) return null;
  const words = texto.split(/\s+/).filter(Boolean);
  const last = words.length - 1;
  return words
    .map((word, index) => {
      const suffix = word.match(PONTUACAO_FINAL)?.[0] ?? "";
      return normalizeWord(word.slice(0, word.length - suffix.length), index, last, siglas) + suffix;
    })
    .join(" ");
}
