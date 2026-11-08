import { IconPrinter } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";

import { api, ApiError } from "@/lib/api";
import { formatarCep, formatarCnpj, formatarCpf, formatarData, formatarMoeda, formatarTelefone } from "@/lib/mascaras";
import type { Cliente, EnderecoCliente } from "@/resources/clientes/types";

import type { Orcamento } from "./types";

type Empresa = {
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  email: string;
  telefone: string;
  logotipo: string | null;
  enderecos: { tipo: string; cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string }[];
};

const num = (v: string | number, casas = 2) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const agora = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }).replace(",", "");

/** Faixa de título das seções, como na impressão da MarketUP (barra à esquerda e linha cinza). */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid-page">
      <h2 className="border-b-2 border-l-4 border-gray-400 bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{titulo}</h2>
      <div className="px-1 pt-1.5">{children}</div>
    </section>
  );
}

/** "Rótulo: valor" com o valor em negrito. */
function Par({ rotulo, valor, className }: { rotulo: string; valor?: ReactNode; className?: string }) {
  return (
    <span className={className}>
      <span className="text-gray-600">{rotulo}: </span>
      <strong>{valor || "—"}</strong>
    </span>
  );
}

/** Endereço em bloco (cobrança ou entrega), para ficarem lado a lado. */
function Endereco({ titulo, e }: { titulo: string; e?: EnderecoCliente }) {
  return (
    <Secao titulo={titulo}>
      {e ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className="text-gray-600">Endereço:</span>
          <strong>
            {e.logradouro}
            {e.numero ? `, ${e.numero}` : ""}
          </strong>
          {e.complemento && (
            <>
              <span className="text-gray-600">Complemento:</span>
              <strong>{e.complemento}</strong>
            </>
          )}
          <span className="text-gray-600">Bairro:</span>
          <strong>{e.bairro || "—"}</strong>
          <span className="text-gray-600">Cidade:</span>
          <strong>
            {e.cidade}
            {e.uf ? ` - ${e.uf}` : ""}
          </strong>
          <span className="text-gray-600">CEP:</span>
          <strong>{e.exterior ? "Exterior" : formatarCep(e.cep) || "—"}</strong>
        </div>
      ) : (
        <p className="text-gray-600">Não informado.</p>
      )}
    </Secao>
  );
}

/**
 * Orçamento para imprimir ou salvar em PDF (Ctrl+P → "Salvar como PDF"), no modelo da
 * impressão da MarketUP: empresa no topo, "Orçamento de venda", endereços de cobrança e
 * entrega lado a lado, itens com a OBS de cada um, totais, pagamento, observações e assinaturas.
 */
export function OrcamentoImpressao() {
  const { id } = useParams();
  const [o, setO] = useState<Orcamento | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api<Empresa>("/empresa").then(setEmpresa, () => undefined);
    api<Orcamento>(`/orcamentos/${id}`)
      .then((orc) => {
        setO(orc);
        document.title = `Orçamento ${orc.id}`;
        if (orc.cliente) return api<Cliente>(`/clientes/${orc.cliente}`).then(setCliente);
      })
      .catch((e: ApiError) => setErro(e.message));
  }, [id]);

  if (erro) return <p className="p-8 text-error">{erro}</p>;
  if (!o) return <p className="p-8 text-ink-muted">Carregando…</p>;

  const cobranca = cliente?.enderecos.find((e) => e.id === o.endereco_faturamento);
  const entrega = cliente?.enderecos.find((e) => e.id === o.endereco_entrega);
  const endEmpresa = empresa?.enderecos.find((e) => e.tipo === "faturamento" && e.logradouro);
  const quantidadeItens = o.itens.reduce((s, i) => s + Number(i.quantidade), 0);
  const documento = cliente ? (cliente.cnpj ? ["CNPJ", formatarCnpj(cliente.cnpj)] : cliente.cpf ? ["CPF", formatarCpf(cliente.cpf)] : null) : null;

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <style>{"@page { size: A4; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <div className="mx-auto flex max-w-[210mm] justify-end gap-2 px-4 py-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center gap-2 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground">
          <IconPrinter size={20} aria-hidden /> Imprimir / Salvar PDF
        </button>
      </div>

      <article className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col bg-white p-8 text-[11px] leading-snug text-black shadow print:min-h-[274mm] print:max-w-none print:p-0 print:shadow-none">
        <p className="mb-2 text-sm">Orçamento: {o.id}</p>

        {/* Topo: logotipo à esquerda e dados da empresa à direita, como na MarketUP. */}
        <header className="flex items-start justify-between gap-6">
          <div className="flex h-20 w-44 items-center">
            {empresa?.logotipo && <img src={empresa.logotipo} alt="" className="max-h-20 max-w-44 object-contain" />}
          </div>
          <div className="text-right text-[10px] uppercase leading-tight tracking-wide">
            {empresa?.razao_social && <p>{empresa.razao_social}</p>}
            {empresa?.nome_fantasia && <p>{empresa.nome_fantasia}</p>}
            {empresa?.cnpj && <p>CNPJ: {formatarCnpj(empresa.cnpj)}</p>}
            {endEmpresa && (
              <>
                <p className="normal-case">
                  {endEmpresa.logradouro}, {endEmpresa.numero}
                </p>
                <p className="normal-case">
                  {formatarCep(endEmpresa.cep)} - {endEmpresa.cidade} - {endEmpresa.uf}
                </p>
              </>
            )}
            {empresa?.telefone && <p>{formatarTelefone(empresa.telefone)}</p>}
          </div>
        </header>

        <Secao titulo="Orçamento de venda">
          <div className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-0.5">
            <span className="text-right text-gray-600">Orçamento:</span>
            <strong>{o.id}</strong>
            <span className="text-right text-gray-600">Cliente:</span>
            <strong>{cliente?.nome ?? "—"}</strong>
            {documento && (
              <>
                <span className="text-right text-gray-600">{documento[0]}:</span>
                <strong>{documento[1]}</strong>
              </>
            )}
            <span className="text-right text-gray-600">E-mail:</span>
            <span className="flex flex-wrap gap-x-8">
              <strong>{cliente?.email || "—"}</strong>
              <Par rotulo="Telefone" valor={formatarTelefone(cliente?.telefone || cliente?.celular || "")} />
            </span>
            <span className="text-right text-gray-600">Emissão:</span>
            <span className="flex flex-wrap gap-x-8">
              <strong>{formatarData(o.emissao)}</strong>
              <Par rotulo="Data de entrega" valor={formatarData(o.entrega)} />
              <Par rotulo="Data de validade" valor={formatarData(o.validade)} />
            </span>
            {o.vendedor_nome && (
              <>
                <span className="text-right text-gray-600">Vendedor:</span>
                <strong>{o.vendedor_nome}</strong>
              </>
            )}
          </div>
        </Secao>

        {/* Cobrança e entrega lado a lado. */}
        <div className="grid grid-cols-2 gap-4">
          <Endereco titulo="Endereço de cobrança" e={cobranca} />
          <Endereco titulo="Endereço de entrega" e={entrega} />
        </div>

        {/* Itens: ocupam o espaço livre da folha e empurram o resto para o fim; com muitos itens, passam para a página seguinte. */}
        <div className="flex-1">
        <Secao titulo="Itens do orçamento">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-bold">
                <th className="py-1 pr-2">Referência</th>
                <th className="py-1 pr-2">Descrição</th>
                {/* Unid. e Qtd. abreviados e estreitos: sobra espaço para descrição, unitário e total (valores grandes). */}
                <th className="w-10 py-1 pr-1 text-center">Unid.</th>
                <th className="w-14 py-1 pr-2 text-right">Qtd.</th>
                <th className="whitespace-nowrap py-1 pr-2 text-right">Unitário</th>
                <th className="whitespace-nowrap py-1 pr-2 text-right">Desconto</th>
                <th className="whitespace-nowrap py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {o.itens.map((i, n) => (
                <tr key={i.id ?? n} className="break-inside-avoid align-top">
                  <td className="py-1 pr-2 text-[10px] tabular-nums text-gray-700">{i.codigo_barras || "—"}</td>
                  <td className="py-1 pr-2">
                    {i.descricao}
                    {i.observacao && <span className="mt-0.5 block text-[11px] tracking-wide">OBS: {i.observacao}</span>}
                  </td>
                  <td className="py-1 pr-1 text-center">{i.unidade_sigla}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{num(i.quantidade, 3)}</td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{formatarMoeda(i.valor_unitario)}</td>
                  <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{formatarMoeda(i.desconto)}</td>
                  <td className="whitespace-nowrap py-1 text-right tabular-nums">{formatarMoeda(i.total ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end">
            <div className="flex w-[60%] justify-between rounded-md border border-gray-400 px-3 py-1.5">
              <Par rotulo="Quantidade de Itens" valor={num(quantidadeItens, 3)} />
              <Par rotulo="Valor total dos itens" valor={formatarMoeda(o.subtotal ?? 0)} />
            </div>
          </div>
        </Secao>
        </div>

        {/* Fecho do orçamento: fica junto e vai para o pé da folha (o espaço dos itens empurra). */}
        <div className="break-inside-avoid">
        <Secao titulo="Valor total de orçamento">
          <div className="grid grid-cols-5 items-end gap-2">
            {[
              ["Total dos Itens", o.subtotal ?? 0],
              ["Desconto", o.desconto],
              ["Frete", o.frete],
              ["Outros", o.outros_custos],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string}>
                <p className="font-bold">{rotulo}</p>
                <p className="font-bold tabular-nums">{formatarMoeda(valor as string)}</p>
              </div>
            ))}
            <div className="text-right">
              <p className="font-bold">Valor Total</p>
              <p className="inline-block rounded-md border border-gray-400 px-2 py-1 font-bold tabular-nums">{formatarMoeda(o.total ?? 0)}</p>
            </div>
          </div>
        </Secao>

        <Secao titulo="Forma / condições de pagamento">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-bold">
                <th className="py-1 pr-2">Descrição</th>
                <th className="py-1 pr-2">Vencimento</th>
                <th className="py-1 pr-2">Valor</th>
                <th className="py-1">Observação</th>
              </tr>
            </thead>
            <tbody>
              {o.parcelas.map((p, n) => (
                <tr key={p.id ?? n} className="break-inside-avoid">
                  <td className="py-0.5 pr-2">
                    {p.tipo_pagamento_nome}
                    {p.condicao_pagamento_nome ? ` (${p.condicao_pagamento_nome})` : ""} {p.numero}/{p.quantidade}
                  </td>
                  <td className="py-0.5 pr-2 tabular-nums">{formatarData(p.vencimento)}</td>
                  <td className="py-0.5 pr-2 tabular-nums">{formatarMoeda(p.valor)}</td>
                  <td className="py-0.5">{p.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>

        {/* Observações do orçamento (balão "Comentários" da ficha): sempre abaixo do pagamento, como na MarketUP. */}
        <Secao titulo="Observações">
          <p className="min-h-10 whitespace-pre-line">{o.observacao}</p>
        </Secao>

        <footer className="mt-16 break-inside-avoid">
          <div className="grid grid-cols-2 gap-12 px-10 text-center font-bold">
            <p className="border-t border-gray-500 pt-1">Assinatura do Comprador</p>
            <p className="border-t border-gray-500 pt-1">Assinatura do Recebedor</p>
          </div>
          <div className="mt-1 flex justify-between text-[10px]">
            <span>{empresa?.nome_fantasia || empresa?.razao_social}</span>
            <strong>Impresso em: {agora()}</strong>
          </div>
        </footer>
        </div>
      </article>
    </div>
  );
}
