import { describe, expect, it } from "vitest";

import { comDigito, dataBr, decimalBr, opcoesDre, simNao } from "@/resources/financeiro/regras";

describe("regras do Ajustes › Financeiro", () => {
  it("DRE segue o tipo da conta", () => {
    expect(opcoesDre("S")).toHaveLength(9);
    expect(opcoesDre("E").map((o) => o.label)).toEqual(["Receitas financeiras", "Entradas"]);
  });

  it("mostra booleanos em palavras", () => {
    expect(simNao(true)).toBe("Sim");
    expect(simNao(false)).toBe("Não");
  });

  it("junta número e dígito", () => {
    expect(comDigito("1234", "5")).toBe("1234-5");
    expect(comDigito("1234", "")).toBe("1234");
    expect(comDigito("", "")).toBe("—");
  });

  it("formata decimais e datas no padrão brasileiro", () => {
    expect(decimalBr("1234.5")).toBe("1.234,50");
    expect(dataBr("2026-11-07")).toBe("07/11/2026");
    expect(dataBr(null)).toBe("—");
  });
});
