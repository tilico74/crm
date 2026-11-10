import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { botaoConfirmar } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { LADO, type Lado, type Titulo } from "./titulos";
import type { ContaCorrente, TipoPagamento } from "./types";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const campo = "h-12 w-full rounded-xs border border-secondary bg-secondary-light/30 px-3 text-base text-surface-raised focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";

/**
 * "Recebimento de múltiplas contas" da MarketUP (revenue/new): as contas escolhidas na lista e um só
 * recebimento/pagamento (data, conta corrente, forma), quitando o saldo de cada uma.
 */
export function BaixarVarias({ lado }: { lado: Lado }) {
  const t = LADO[lado];
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { titulos?: Titulo[] } | null };
  const titulos = (state?.titulos ?? []).filter((x) => Number(x.saldo) > 0);
  const [data, setData] = useState(hoje());
  const [conta, setConta] = useState<number | "">("");
  const [forma, setForma] = useState<number | "">("");
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [aviso, setAviso] = useState("");
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => {
      const ativas = r.results.filter((c) => c.ativo);
      setContas(ativas);
      const principal = ativas.find((c) => c.principal);
      if (principal) setConta(principal.id);
    }, () => undefined);
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results.filter((x) => x.ativo)), () => undefined);
  }, []);

  const total = titulos.reduce((s, x) => s + Number(x.saldo), 0);

  const baixar = async () => {
    if (!conta) return setAviso("Informe a conta corrente.");
    setGravando(true);
    setAviso("");
    try {
      await api(`${t.api}/baixar-varias`, { method: "POST", body: JSON.stringify({ contas: titulos.map((x) => x.id), data, conta_corrente: conta, tipo_pagamento: forma || null }) });
      navigate(t.rota, { replace: true });
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível concluir.");
    } finally {
      setGravando(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Financeiro" title={lado === "receber" ? "Recebimento de múltiplas contas" : "Pagamento de múltiplas contas"} />
      <div className="mx-auto max-w-[992px] px-4 pb-16 pt-6 xl:px-0">
        {titulos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Nenhuma conta em aberto escolhida. Marque as contas em <Link to={t.rota} className="font-semibold text-primary underline">{t.titulo}</Link>.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
                  <th className="py-2">Descrição</th><th>Vencimento</th><th>{t.pessoa}</th><th className="text-right">Valor</th><th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((x) => (
                  <tr key={x.id} className="border-b border-line">
                    <td className="py-2 uppercase">{x.descricao}</td>
                    <td className="tabular-nums">{formatarData(x.vencimento)}</td>
                    <td>{x.pessoa_nome || "—"}</td>
                    <td className="text-right tabular-nums">{formatarMoeda(x.valor)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatarMoeda(x.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 bg-ink/90 p-5 text-surface-raised">
              <div className="mb-4 flex items-baseline justify-between border-b border-surface-raised/30 pb-2">
                <span className="text-lg uppercase text-surface-raised/70">{t.acao}</span>
                <span className="text-sm uppercase">Saldo a {lado === "receber" ? "receber" : "pagar"}: <strong className="text-2xl tabular-nums">{formatarMoeda(total)}</strong></span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label><span className="text-xs uppercase text-surface-raised/80">Data</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
                <label>
                  <span className="text-xs uppercase text-surface-raised/80">Conta corrente *</span>
                  <select value={conta} onChange={(e) => setConta(e.target.value ? Number(e.target.value) : "")} className={campo}>
                    <option value="">Selecione</option>
                    {contas.map((c) => <option key={c.id} value={c.id} className="text-ink">{c.nome}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-xs uppercase text-surface-raised/80">Efetuado em</span>
                  <select value={forma} onChange={(e) => setForma(e.target.value ? Number(e.target.value) : "")} className={campo}>
                    <option value="">—</option>
                    {tipos.map((x) => <option key={x.id} value={x.id} className="text-ink">{x.descricao}</option>)}
                  </select>
                </label>
              </div>
              {aviso && <p role="alert" className="mt-3 text-sm font-semibold text-warning">{aviso}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Link to={t.rota} className="inline-flex min-h-12 items-center px-4 text-sm font-semibold uppercase text-surface-raised/80 hover:text-surface-raised">Voltar</Link>
                <button type="button" onClick={baixar} disabled={gravando} className={cn(botaoConfirmar, "min-w-40")}>
                  {gravando ? "Gravando…" : lado === "receber" ? "Receber" : "Pagar"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
