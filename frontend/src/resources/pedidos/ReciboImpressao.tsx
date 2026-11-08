import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { api, ApiError } from "@/lib/api";
import { reaisPorExtenso } from "@/lib/extenso";
import { formatarCnpj, formatarCpf, formatarData, formatarMoeda } from "@/lib/mascaras";
import { CabecalhoEmpresa, enderecoEmpresa, FolhaImpressao, Par, RodapeAssinaturas, Secao, type Empresa } from "@/resources/orcamentos/impressao";

import type { Recibo } from "./types";

/**
 * Recibo de uma parcela recebida (botão Imprimir do "Emitir recibo"), no mesmo padrão das
 * impressões do orçamento e do pedido: topo da empresa, seções com faixa cinza, valores, assinatura e "Impresso em".
 */
export function ReciboImpressao() {
  const { conta } = useParams();
  const [r, setR] = useState<Recibo | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api<Empresa>("/empresa").then(setEmpresa, () => undefined);
    api<Recibo>(`/contas-receber/${conta}/recibo`).then(
      (x) => {
        setR(x);
        document.title = `Recibo ${x.numero}`;
      },
      (e: ApiError) => setErro(e.message),
    );
  }, [conta]);

  if (erro) return <p className="p-8 text-error">{erro}</p>;
  if (!r) return <p className="p-8 text-ink-muted">Carregando…</p>;
  const cidade = enderecoEmpresa(empresa);
  const documento = r.documento.length > 11 ? ["CNPJ", formatarCnpj(r.documento)] : r.documento ? ["CPF", formatarCpf(r.documento)] : null;

  return (
    <FolhaImpressao>
      <p className="mb-2 text-sm">Recibo: {r.numero}</p>

      <CabecalhoEmpresa empresa={empresa} />

      <Secao titulo="Recibo de pagamento">
        <div className="grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-0.5">
          <span className="text-right text-gray-600">Recebi(emos) de:</span>
          <strong>{r.recebi_de || "—"}</strong>
          {documento && (
            <>
              <span className="text-right text-gray-600">{documento[0]}:</span>
              <strong>{documento[1]}</strong>
            </>
          )}
          <span className="text-right text-gray-600">Referente a:</span>
          <strong>{r.referente}</strong>
          <span className="text-right text-gray-600">Recebido em:</span>
          <span className="flex flex-wrap gap-x-8">
            <strong>{formatarData(r.data)}</strong>
            <Par rotulo="Vencimento" valor={formatarData(r.vencimento)} />
            <Par rotulo="Forma" valor={r.formas.join(", ")} />
          </span>
        </div>
      </Secao>

      <Secao titulo="Valor recebido">
        <div className="grid grid-cols-4 items-end gap-2">
          {[
            ["Subtotal", r.subtotal],
            ["Juros", r.juros],
            ["Desconto", r.desconto],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <p className="font-bold">{rotulo}</p>
              <p className="font-bold tabular-nums">{formatarMoeda(valor)}</p>
            </div>
          ))}
          <div className="text-right">
            <p className="font-bold">Valor Total</p>
            <p className="inline-block rounded-md border border-gray-400 px-2 py-1 font-bold tabular-nums">{formatarMoeda(r.total)}</p>
          </div>
        </div>
      </Secao>

      <Secao titulo="Importância por extenso">
        <p className="text-[12px]">
          Recebi(emos) de <strong>{r.recebi_de}</strong> a importância de <strong>{reaisPorExtenso(r.total)}</strong> ({formatarMoeda(r.total)}), referente a{" "}
          <strong>{r.referente}</strong>, dando plena quitação deste valor.
        </p>
      </Secao>

      <p className="mt-6 text-right text-[12px]">
        {cidade ? `${cidade.cidade} - ${cidade.uf}, ` : ""}
        {formatarData(r.data)}.
      </p>

      <RodapeAssinaturas empresa={empresa} assinaturas={[<span key="a">{r.assinatura}<span className="block text-[10px] font-normal">Emitente</span></span>]} />
    </FolhaImpressao>
  );
}
