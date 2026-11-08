import { describe, expect, it } from "vitest";

import {
  cnpjValido,
  cpfValido,
  formatar,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  formatarCpfCnpj,
  formatarData,
  formatarMoeda,
  formatarPercentual,
  formatarRg,
  formatarTelefone,
  limpar,
  validar,
} from "@/lib/mascaras";

// Mesmos exemplos de backend/tests/test_documentos.py.
const CPF = "529.982.247-25";
const CNPJ_NUMERICO = "11.222.333/0001-81";
const CNPJ_ALFANUMERICO = "12.ABC.345/01DE-35";

describe("formatação", () => {
  it("formata documentos completos", () => {
    expect(formatarCpf("52998224725")).toBe(CPF);
    expect(formatarCnpj("11222333000181")).toBe(CNPJ_NUMERICO);
    expect(formatarCnpj("12abc34501de35")).toBe(CNPJ_ALFANUMERICO);
    expect(formatarCep("88138152")).toBe("88138-152");
    expect(formatarTelefone("48999614233")).toBe("(48) 99961-4233");
    expect(formatarTelefone("4832221234")).toBe("(48) 3222-1234");
  });

  it("formata enquanto digita, sem passar do tamanho", () => {
    expect(formatarCpf("5299")).toBe("529.9");
    expect(formatarCep("881381")).toBe("88138-1");
    expect(formatarTelefone("4899")).toBe("(48) 99");
    expect(formatarCpf("529982247251234")).toBe(CPF);
  });

  it("escolhe CPF ou CNPJ pelo tamanho e pelas letras", () => {
    expect(formatarCpfCnpj("52998224725")).toBe(CPF);
    expect(formatarCpfCnpj("11222333000181")).toBe(CNPJ_NUMERICO);
    expect(formatarCpfCnpj("12ABC")).toBe("12.ABC");
  });

  it("RG nos tamanhos comuns e livre nos outros", () => {
    expect(formatarRg("12345678X")).toBe("12.345.678-X");
    expect(formatarRg("1234567")).toBe("1.234.567");
    expect(formatarRg("1234567890")).toBe("1234567890");
  });

  it("limpa para gravar", () => {
    expect(limpar("cpf", CPF)).toBe("52998224725");
    expect(limpar("cnpj", "12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(limpar("telefone", "(48) 99961-4233")).toBe("48999614233");
    expect(formatar("cep", null)).toBe("");
  });

  it("moeda, percentual e data", () => {
    expect(formatarMoeda("1234.5")).toBe("R$ 1.234,50");
    expect(formatarPercentual("5.00")).toBe("5,00%");
    expect(formatarData("2026-11-07")).toBe("07/11/2026");
    expect(formatarData("2026-11-07T10:00:00Z")).toBe("07/11/2026");
  });
});

describe("validação", () => {
  it("CPF", () => {
    expect(cpfValido(CPF)).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });

  it("CNPJ numérico e alfanumérico", () => {
    expect(cnpjValido(CNPJ_NUMERICO)).toBe(true);
    expect(cnpjValido(CNPJ_ALFANUMERICO)).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(cnpjValido("12.ABC.345/01DE-3A")).toBe(false);
  });

  it("mensagens", () => {
    expect(validar("cpf", "")).toBe("");
    expect(validar("cpf", "123")).toMatch(/CPF inválido/);
    expect(validar("cpfCnpj", CNPJ_ALFANUMERICO)).toBe("");
    expect(validar("telefone", "4899")).toMatch(/DDD/);
  });
});
