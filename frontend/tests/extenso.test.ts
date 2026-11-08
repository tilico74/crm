import { describe, expect, it } from "vitest";

import { reaisPorExtenso } from "../src/lib/extenso";

describe("valor por extenso do recibo", () => {
  it.each([
    [1, "um real"],
    [0.01, "um centavo"],
    [100, "cem reais"],
    [101, "cento e um reais"],
    [1200, "mil e duzentos reais"],
    [1250.5, "mil duzentos e cinquenta reais e cinquenta centavos"],
    [3051.6, "três mil e cinquenta e um reais e sessenta centavos"],
    [21000, "vinte e um mil reais"],
    [2000000, "dois milhões de reais"],
    [1001001, "um milhão, mil e um reais"],
    [1000001, "um milhão e um reais"],
  ])("%s → %s", (valor, texto) => {
    expect(reaisPorExtenso(valor)).toBe(texto);
  });
});
