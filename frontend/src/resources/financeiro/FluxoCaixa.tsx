import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

import type { ContaCorrente } from "./types";

type Linha = { nome: string; valores: string[] };
type Titulo = { descricao: string; pessoa: string; titulo: number | null; valores: string[] };
type Conta = Linha & { titulos: Titulo[] };
type Grupo = Linha & { contas: Conta[] };
type Card = { total: string; quantidade: number; crescimento: string | null };
type Fluxo = {
  hoje: string;
  colunas: { inicio: string; fim: string; titulo: string; subtitulo: string; previsto: boolean }[];
  saldo_inicial: string[];
  receita: { valores: string[]; grupos: Grupo[] };
  despesa: { valores: string[]; grupos: Grupo[] };
  saldo_final: string[];
  inadimplencia: Card;
  endividamento: Card;
};

const hoje = () => new Date().toLocaleDateString("sv-SE");
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("sv-SE");
const num = (v: string | number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";
const PERCENTUAIS = [0, 15, 30, 50, 75];

/**
 * Financeiro › Fluxo de caixa (cash_flow da MarketUP). Até hoje: realizado; depois: previsto (contas em aberto
 * pelo vencimento). Receita (Operacionais / Não operacionais) e Despesa (grupos do DRE) abrem por conta gerencial
 * e por título. Cards de inadimplência e endividamento com simulação mensal, como a MarketUP.
 */
export function FluxoCaixa() {
  const [de, setDe] = useState(diasAtras(6));
  const [ate, setAte] = useState(hoje());
  const [conta, setConta] = useState("");
  const [visao, setVisao] = useState<"dias" | "meses">("meses");
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [fluxo, setFluxo] = useState<Fluxo | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [simReceber, setSimReceber] = useState(0);
  const [simPagar, setSimPagar] = useState(0);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => setContas(r.results.filter((c) => c.ativo)), () => undefined);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ de, ate, visao });
    if (conta) q.set("conta_corrente", conta);
    setAviso("");
    api<Fluxo>(`/fluxo-caixa?${q}`).then(setFluxo, (e: ApiError) => setAviso(e.message));
  }, [de, ate, conta, visao]);

  const alternar = (chave: string) => setAbertos((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });

  // Simulação da MarketUP (changeReceivableSimulation / changePayableSimulation): a cada coluna, recebe/paga X% do que resta.
  const simulado = useMemo(() => {
    if (!fluxo) return [];
    const n = fluxo.colunas.length;
    const serie = (total: number, pct: number) => {
      const out: number[] = [];
      let saldo = total;
      for (let i = 0; i < n; i++) {
        let parcela = (saldo * pct) / 100;
        if (saldo - parcela < 0) parcela = saldo;
        out.push(parcela);
        saldo -= parcela;
      }
      return out;
    };
    const rec = serie(Number(fluxo.inadimplencia.total), simReceber);
    const pag = serie(Number(fluxo.endividamento.total), simPagar);
    return fluxo.saldo_final.map((v, i) => Number(v) + rec.slice(0, i + 1).reduce((a, b) => a + b, 0) - pag.slice(0, i + 1).reduce((a, b) => a + b, 0));
  }, [fluxo, simReceber, simPagar]);

  const celulas = (valores: string[] | number[], cor?: string) =>
    valores.map((v, i) => (
      <td key={i} className={cn("border-l border-line px-3 py-2 text-right tabular-nums", fluxo?.colunas[i]?.previsto && "italic text-ink-muted", cor)}>{num(v)}</td>
    ));

  const ramo = (tipo: "receita" | "despesa") => {
    if (!fluxo) return null;
    const bloco = fluxo[tipo];
    const chave = tipo;
    const cor = tipo === "receita" ? "bg-success-soft text-success" : "bg-error-soft text-error";
    return (
      <>
        <tr className={cn("cursor-pointer", cor)} onClick={() => alternar(chave)}>
          <th scope="row" className="px-3 py-3 text-left font-semibold uppercase">
            <span className="flex items-center justify-between">{tipo === "receita" ? "Receita" : "Despesa"}{abertos.has(chave) ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}</span>
          </th>
          {celulas(bloco.valores)}
        </tr>
        {abertos.has(chave) && bloco.grupos.map((g) => (
          <Fragment key={g.nome}>
            <tr className="cursor-pointer bg-surface" onClick={() => alternar(`${chave}/${g.nome}`)}>
              <th scope="row" className="py-2 pl-6 pr-3 text-left text-sm font-semibold">{g.nome}</th>
              {celulas(g.valores)}
            </tr>
            {abertos.has(`${chave}/${g.nome}`) && g.contas.map((c) => (
              <Fragment key={c.nome}>
                <tr className="cursor-pointer" onClick={() => alternar(`${chave}/${g.nome}/${c.nome}`)}>
                  <th scope="row" className="py-2 pl-10 pr-3 text-left text-sm font-normal">{c.nome}</th>
                  {celulas(c.valores)}
                </tr>
                {abertos.has(`${chave}/${g.nome}/${c.nome}`) && c.titulos.map((t, n) => (
                  <tr key={n} className="text-xs text-ink-muted">
                    <th scope="row" className="py-1 pl-14 pr-3 text-left font-normal">
                      {t.titulo ? (
                        <Link to={`/financeiro/${Number(t.valores.find((v) => Number(v) !== 0) ?? 0) >= 0 ? "contas-a-receber" : "contas-a-pagar"}/${t.titulo}`} className="text-primary underline">{t.descricao}</Link>
                      ) : t.descricao}
                      {t.pessoa && <span className="block">{t.pessoa}</span>}
                    </th>
                    {celulas(t.valores)}
                  </tr>
                ))}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </>
    );
  };

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Fluxo de caixa" />
      <div className="mx-auto mt-4 flex max-w-[1100px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted"><span className="mb-1 font-label">Período de</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={controle} /></label>
        <label className="flex flex-col text-sm text-ink-muted"><span className="mb-1 font-label">Até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} /></label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Contas</span>
          <select value={conta} onChange={(e) => setConta(e.target.value)} className={controle}>
            <option value="">Todas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <span className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Visualizar por</span>
          <span className="inline-flex" role="group" aria-label="Visualizar por">
            {(["dias", "meses"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={visao === v} onClick={() => setVisao(v)} className={cn("h-12 w-20 border text-sm font-semibold uppercase md:h-[34px]", visao === v ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface-raised text-ink")}>{v}</button>
            ))}
          </span>
        </span>
      </div>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[1100px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

      {fluxo && (
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 xl:px-0">
          <p className="mb-2 text-center text-sm uppercase tracking-wide text-warning-ink">{visao === "meses" ? "Visão mensal" : "Visão diária"}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border border-line text-sm">
              <thead>
                <tr>
                  <th className="w-64" />
                  {fluxo.colunas.map((c, i) => (
                    <th key={i} className="border-l border-line px-3 py-2 text-right font-normal">
                      <span className="block font-semibold text-ink">{c.titulo}</span>
                      <span className="text-[10px] uppercase text-ink-muted">{c.subtitulo}{c.previsto ? " · previsto" : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-y border-line"><th scope="row" className="px-3 py-3 text-left font-semibold uppercase text-ink">Saldo inicial</th>{celulas(fluxo.saldo_inicial)}</tr>
                {ramo("receita")}
                {ramo("despesa")}
                <tr className="border-y border-line"><th scope="row" className="px-3 py-3 text-left font-semibold uppercase text-ink">Saldo final</th>{celulas(fluxo.saldo_final, "font-semibold")}</tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Colunas em itálico: previsto (contas em aberto pelo vencimento). As vencidas em aberto entram no primeiro dia previsto, como na MarketUP.</p>

          {/* Cards da MarketUP. */}
          <div className="mt-6 space-y-2">
            {([
              ["Inadimplência", fluxo.inadimplencia, "bg-brand-cyan", "/financeiro/contas-a-receber", "recebimento", simReceber, setSimReceber],
              ["Endividamento", fluxo.endividamento, "bg-warning", "/financeiro/contas-a-pagar", "pagamento", simPagar, setSimPagar],
            ] as const).map(([nome, card, cor, rota, verbo, pct, setPct]) => (
              <div key={nome} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]">
                <span className="text-sm font-semibold uppercase text-ink">{nome}</span>
                <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-black", cor)}>
                  <span className="text-2xl font-bold tabular-nums">R$ {num(card.total)}</span>
                  <span className="text-center text-xs uppercase"><strong className="block text-lg">{card.quantidade}</strong>contas</span>
                  <span className="text-center text-xs uppercase"><strong className="block text-lg">{card.crescimento !== null ? `${Number(card.crescimento) >= 0 ? "+" : ""}${num(card.crescimento)}%` : "—"}</strong>últimos 30 dias</span>
                  <Link to={rota} className="border border-black/60 px-3 py-1 text-xs font-semibold uppercase hover:bg-black/10">Ver todos</Link>
                  <label className="ml-auto flex items-center gap-2 text-xs">
                    Simular {verbo} mensal de:
                    <select value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-9 rounded-xs border border-black/40 bg-white/80 px-2">
                      {PERCENTUAIS.map((p) => <option key={p} value={p}>{p}%</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border border-line text-sm">
              <tbody>
                <tr><th scope="row" className="w-64 px-3 py-3 text-left font-semibold uppercase text-ink">Saldo simulado</th>{celulas(simulado)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
