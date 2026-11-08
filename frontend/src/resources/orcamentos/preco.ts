import type { Produto, Servico } from "@/resources/catalogo/types";
import type { ListaPreco, TipoValor } from "@/resources/clientes/types";

/** Produto ou serviço na busca "Digite o nome ou código do item". */
export type ItemCatalogo = {
  chave: string;
  tipo: "produto" | "servico";
  id: number;
  codigo: string;
  nome: string;
  unidade: number | null;
  sigla?: string;
  produto?: Produto;
  servico?: Servico;
};

export type UnidadeVenda = { id: number; sigla: string; fracionada: boolean };

/**
 * Unidades em que o item pode ser vendido (a seta embaixo de "QNTD." na MarketUP):
 * a unidade do produto e, se ele é vendido fracionado, a unidade da fração
 * (ex.: Rolo e Metro). Regra da MarketUP: só entra a fração com valor de venda > 0.
 */
export function unidadesDoItem(item: ItemCatalogo): UnidadeVenda[] {
  const lista: UnidadeVenda[] = item.unidade ? [{ id: item.unidade, sigla: item.sigla ?? "", fracionada: false }] : [];
  const p = item.produto;
  if (p?.fragmentacao_unidade && Number(p.fragmentacao_preco) > 0 && p.fragmentacao_unidade !== item.unidade) {
    lista.push({ id: p.fragmentacao_unidade, sigla: p.fragmentacao_unidade_sigla ?? "", fracionada: true });
  }
  return lista;
}

/** A unidade escolhida é a da fração? (na MarketUP: unidade diferente da unidade do produto). */
export const ehFracionada = (item: ItemCatalogo, unidade: number | null) => !!unidade && !!item.unidade && unidade !== item.unidade;

const aplicar = (preco: number, desconto: string, tipo: TipoValor) =>
  tipo === "P" ? preco * (1 - Number(desconto || 0) / 100) : preco - Number(desconto || 0);

/**
 * Preço unitário sugerido (o vendedor pode alterar), com as regras da MarketUP:
 * 1. Vendido fracionado: valor de venda da fração; não usa preço de atacado.
 * 2. Senão, atacado quando o produto tem preço de atacado e a quantidade chega na mínima; senão, varejo.
 * 3. Desconto da lista de preços do cliente (varejo ou atacado, em R$ por unidade ou %);
 *    item com desconto diferenciado na lista usa o desconto próprio.
 */
export function precoNaLista(item: ItemCatalogo, quantidade: number, lista: ListaPreco | null, unidade: number | null = item.unidade): string {
  const p = item.produto;
  const fracionado = ehFracionada(item, unidade);
  const atacado = !fracionado && !!p && Number(p.preco_atacado) > 0 && Number(p.quantidade_minima_atacado) > 0 && quantidade >= Number(p.quantidade_minima_atacado);
  let preco = fracionado ? Number(p?.fragmentacao_preco) : Number(atacado ? p!.preco_atacado : (p ?? item.servico)!.preco_venda);
  if (lista) {
    const especial = lista.itens.find((i) => (item.tipo === "produto" ? i.produto === item.id : i.servico === item.id));
    const regra = especial ?? lista;
    preco = atacado ? aplicar(preco, regra.desconto_atacado, regra.desconto_atacado_tipo) : aplicar(preco, regra.desconto_varejo, regra.desconto_varejo_tipo);
  }
  return Math.max(0, Math.round(preco * 100) / 100).toFixed(2);
}
