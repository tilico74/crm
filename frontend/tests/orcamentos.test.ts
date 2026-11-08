import { describe, expect, it } from "vitest";

import { lerNumeroBr, numeroBr } from "@/components/CampoNumero";
import type { Produto } from "@/resources/catalogo/types";
import type { ListaPreco } from "@/resources/clientes/types";
import { ehFracionada, precoNaLista, unidadesDoItem, type ItemCatalogo } from "@/resources/orcamentos/preco";
import { totaisOrcamento, type ItemOrcamento } from "@/resources/orcamentos/types";

const item = (quantidade: string): ItemOrcamento => ({
  produto: 23, servico: null, descricao: "Instalação", unidade: 6, quantidade, valor_unitario: "78.19",
  desconto: "0", desconto_percentual: "0", desconto_em_percentual: false, fragmentado: false, observacao: "",
});

describe("orçamento", () => {
  it("prévia dos totais bate com o orçamento 3874 da MarketUP (e com o back-end)", () => {
    const base = { itens: [item("2.99"), item("2.47"), item("2.47")], desconto: "0.05", desconto_percentual: "0", desconto_em_percentual: false, frete: "0", outros_custos: "0" };
    expect(totaisOrcamento(base)).toEqual({ subtotal: 620.05, desconto: 0.05, total: 620 });
    expect(totaisOrcamento({ ...base, desconto_em_percentual: true, desconto_percentual: "10", frete: "30" }).total).toBe(588.04);
  });

  it("preço sugerido usa atacado e a lista de preços do cliente", () => {
    const produto = { preco_venda: "100.00", preco_atacado: "80.00", quantidade_minima_atacado: "10" } as Produto;
    const c: ItemCatalogo = { chave: "p1", tipo: "produto", id: 1, codigo: "", nome: "Rede", unidade: 1, produto };
    expect(precoNaLista(c, 1, null)).toBe("100.00");
    expect(precoNaLista(c, 10, null)).toBe("80.00");
    const lista = { desconto_varejo: "10", desconto_varejo_tipo: "P", desconto_atacado: "5", desconto_atacado_tipo: "R", itens: [] } as unknown as ListaPreco;
    expect(precoNaLista(c, 1, lista)).toBe("90.00");
    expect(precoNaLista(c, 10, lista)).toBe("75.00");
    const especial = { ...lista, itens: [{ produto: 1, servico: null, desconto_varejo: "1", desconto_varejo_tipo: "R", desconto_atacado: "0", desconto_atacado_tipo: "R" }] } as ListaPreco;
    expect(precoNaLista(c, 1, especial)).toBe("99.00");
  });
});


describe("CampoNumero", () => {
  it("lê número digitado em pt-BR e recusa texto inválido", () => {
    expect(lerNumeroBr("78,19")).toBe("78.19");
    expect(lerNumeroBr("1.234,5")).toBe("1234.5");
    expect(lerNumeroBr("2.99")).toBe("2.99");
    expect(lerNumeroBr("10")).toBe("10");
    expect(lerNumeroBr("")).toBe("0");
    expect(lerNumeroBr("55,0078,19")).toBeNull();
    expect(lerNumeroBr("2,")).toBe("2");
    expect(numeroBr("abc")).toBe("0,00");
    expect(numeroBr("2.99", 3)).toBe("2,990");
  });
});

describe("venda fracionada (seta da unidade)", () => {
  const rolo = {
    preco_venda: "500.00", preco_atacado: "450.00", quantidade_minima_atacado: "2",
    fragmentacao_quantidade: "50", fragmentacao_unidade: 7, fragmentacao_unidade_sigla: "M", fragmentacao_preco: "12.00",
  } as Produto;
  const item: ItemCatalogo = { chave: "p9", tipo: "produto", id: 9, codigo: "", nome: "Rede em rolo", unidade: 1, sigla: "UN", produto: rolo };

  it("lista a unidade do produto e a da fração", () => {
    expect(unidadesDoItem(item)).toEqual([
      { id: 1, sigla: "UN", fracionada: false },
      { id: 7, sigla: "M", fracionada: true },
    ]);
    expect(unidadesDoItem({ ...item, produto: { ...rolo, fragmentacao_preco: "0" } as Produto })).toHaveLength(1);
  });

  it("fração usa o valor da fração e nunca o atacado", () => {
    expect(ehFracionada(item, 7)).toBe(true);
    expect(precoNaLista(item, 1, null, 1)).toBe("500.00");
    expect(precoNaLista(item, 3, null, 1)).toBe("450.00");
    expect(precoNaLista(item, 3, null, 7)).toBe("12.00");
  });
});
