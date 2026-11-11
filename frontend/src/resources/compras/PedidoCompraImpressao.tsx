import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { api, ApiError } from "@/lib/api";
import { formatarCep, formatarCnpj, formatarCpf, formatarData, formatarMoeda, formatarTelefone } from "@/lib/mascaras";
import { CabecalhoEmpresa, FolhaImpressao, Par, RodapeAssinaturas, Secao, type Empresa } from "@/resources/orcamentos/impressao";

import type { PedidoCompra } from "./pedidos";

const num = (v: string | number, casas = 2) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Endereco({ titulo, p, prefixo }: { titulo: string; p: PedidoCompra; prefixo: "fat" | "ent" }) {
  const v = (c: string) => (p as unknown as Record<string, string>)[`${prefixo}_${c}`] ?? "";
  return (
    <Secao titulo={titulo}>
      {v("logradouro") ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className="text-gray-600">Endereço:</span><strong>{[v("logradouro"), v("numero")].filter(Boolean).join(", ")}</strong>
          {v("complemento") && (<><span className="text-gray-600">Complemento:</span><strong>{v("complemento")}</strong></>)}
          <span className="text-gray-600">Bairro:</span><strong>{v("bairro") || "—"}</strong>
          <span className="text-gray-600">Cidade:</span><strong>{v("cidade")}{v("uf") ? ` - ${v("uf")}` : ""}</strong>
          <span className="text-gray-600">CEP:</span><strong>{formatarCep(v("cep")) || "—"}</strong>
        </div>
      ) : (
        <p className="text-gray-600">Não informado.</p>
      )}
    </Secao>
  );
}

/** Pedido de compra para imprimir ou salvar em PDF, no mesmo modelo da impressão do pedido de venda. */
export function PedidoCompraImpressao() {
  const { id } = useParams();
  const [p, setP] = useState<PedidoCompra | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api<Empresa>("/empresa").then(setEmpresa, () => undefined);
    api<PedidoCompra>(`/pedidos-compra/${id}`).then((x) => {
      setP(x);
      document.title = `Pedido de compra ${x.id}`;
    }, (e: ApiError) => setErro(e.message));
  }, [id]);

  if (erro) return <p className="p-8 text-error">{erro}</p>;
  if (!p) return <p className="p-8 text-ink-muted">Carregando…</p>;
  const d = p.fornecedor_documento ?? "";
  const documento = d.length === 14 ? ["CNPJ", formatarCnpj(d)] : d.length === 11 ? ["CPF", formatarCpf(d)] : null;
  const quantidadeItens = p.itens.reduce((s, i) => s + Number(i.quantidade), 0);

  return (
    <FolhaImpressao className="min-h-[297mm] print:min-h-[274mm]">
      <p className="mb-2 text-sm">Pedido de compra: {p.id}</p>
      <CabecalhoEmpresa empresa={empresa} />
      <Secao titulo="Pedido de compra">
        <div className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-0.5">
          <span className="text-right text-gray-600">Pedido:</span><strong>{p.id}</strong>
          <span className="text-right text-gray-600">Fornecedor:</span><strong>{p.fornecedor_nome ?? "—"}</strong>
          {documento && (<><span className="text-right text-gray-600">{documento[0]}:</span><span className="flex flex-wrap gap-x-8"><strong>{documento[1]}</strong>{p.fornecedor_ie && <Par rotulo="IE" valor={p.fornecedor_ie} />}</span></>)}
          <span className="text-right text-gray-600">E-mail:</span>
          <span className="flex flex-wrap gap-x-8"><strong>{p.fornecedor_email || "—"}</strong><Par rotulo="Telefone" valor={formatarTelefone(p.fornecedor_telefone ?? "")} /></span>
          <span className="text-right text-gray-600">Emissão:</span>
          <span className="flex flex-wrap gap-x-8">
            <strong>{formatarData(p.emissao)}</strong>
            <Par rotulo="Recebimento" valor={formatarData(p.previsao)} />
            {p.data_faturamento && <Par rotulo="Faturado em" valor={formatarData(p.data_faturamento)} />}
          </span>
          {p.comprador_nome && (<><span className="text-right text-gray-600">Comprador:</span><strong>{p.comprador_nome}</strong></>)}
        </div>
      </Secao>
      <div className="grid grid-cols-2 gap-4">
        <Endereco titulo="Endereço de faturamento" p={p} prefixo="fat" />
        <Endereco titulo="Endereço de entrega" p={p} prefixo="ent" />
      </div>
      <div className="flex-1">
        <Secao titulo="Itens do pedido">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-bold">
                <th className="py-1 pr-2">Referência</th><th className="py-1 pr-2">Descrição</th><th className="w-10 py-1 pr-1 text-center">Unid.</th>
                <th className="w-14 py-1 pr-2 text-right">Qtd.</th><th className="py-1 pr-2 text-right">Unitário</th><th className="py-1 pr-2 text-right">Desconto</th><th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {p.itens.map((i, n) => (
                <tr key={i.id ?? n} className="break-inside-avoid align-top">
                  <td className="py-1 pr-2 text-[10px] tabular-nums text-gray-700">{i.codigo_barras || "—"}</td>
                  <td className="py-1 pr-2">{i.descricao}{i.observacao && <span className="mt-0.5 block text-[11px]">OBS: {i.observacao}</span>}</td>
                  <td className="py-1 pr-1 text-center">{i.unidade_sigla}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{num(i.quantidade, 3)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatarMoeda(i.valor_unitario)}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatarMoeda(i.desconto)}</td>
                  <td className="py-1 text-right tabular-nums">{formatarMoeda(i.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end">
            <div className="flex w-[60%] justify-between rounded-md border border-gray-400 px-3 py-1.5">
              <Par rotulo="Quantidade de Itens" valor={num(quantidadeItens, 3)} />
              <Par rotulo="Valor total dos itens" valor={formatarMoeda(p.subtotal ?? 0)} />
            </div>
          </div>
        </Secao>
      </div>
      <div className="break-inside-avoid">
        <Secao titulo="Valor total do pedido">
          <div className="grid grid-cols-5 items-end gap-2">
            {[["Total dos Itens", p.subtotal ?? 0], ["Desconto", p.desconto], ["Frete", p.frete], ["Outros", p.outros_custos]].map(([r, v]) => (
              <div key={r as string}><p className="font-bold">{r}</p><p className="font-bold tabular-nums">{formatarMoeda(v as string)}</p></div>
            ))}
            <div className="text-right"><p className="font-bold">Valor Total</p><p className="inline-block rounded-md border border-gray-400 px-2 py-1 font-bold tabular-nums">{formatarMoeda(p.total ?? 0)}</p></div>
          </div>
        </Secao>
        <Secao titulo="Forma / condições de pagamento">
          <table className="w-full border-collapse">
            <thead><tr className="text-left text-[10px] font-bold"><th className="py-1 pr-2">Descrição</th><th className="py-1 pr-2">Vencimento</th><th className="py-1 pr-2">Valor</th><th className="py-1">Observação</th></tr></thead>
            <tbody>
              {p.parcelas.map((x, n) => (
                <tr key={x.id ?? n} className="break-inside-avoid">
                  <td className="py-0.5 pr-2">{x.tipo_pagamento_nome ?? "Importado XML"}{x.condicao_pagamento_nome ? ` (${x.condicao_pagamento_nome})` : ""} {x.numero}/{x.quantidade}</td>
                  <td className="py-0.5 pr-2 tabular-nums">{formatarData(x.vencimento)}</td>
                  <td className="py-0.5 pr-2 tabular-nums">{formatarMoeda(x.valor)}</td>
                  <td className="py-0.5">{x.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
        <Secao titulo="Observações"><p className="min-h-10 whitespace-pre-line">{p.observacao}</p></Secao>
        <RodapeAssinaturas empresa={empresa} assinaturas={["Assinatura do Comprador", "Assinatura do Fornecedor"]} />
      </div>
    </FolhaImpressao>
  );
}
