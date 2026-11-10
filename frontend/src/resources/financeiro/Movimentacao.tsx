import { IconPencil, IconTrash } from "@tabler/icons-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { botaoCancelar, botaoConfirmar, Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import type { ContaCorrente, ContaGerencial, TipoPagamento } from "./types";

export const ROTA_MOVIMENTACAO = "/financeiro/movimentacao-de-caixa";

type Movimento = {
  id: number; data: string; conta_corrente_nome: string; descricao: string; manual: boolean; tipo_pagamento_nome: string;
  credito: boolean; valor: string; conta_receber: number | null; conta_pagar: number | null; transferencia: number | null;
};
type Resposta = { saldo_periodo: string; saldo_atual: string; results: Movimento[] };

const hoje = () => new Date().toLocaleDateString("sv-SE");
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("sv-SE");
const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";
const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const rotulo = "mb-1 block text-xs font-semibold uppercase text-ink";

/**
 * Financeiro › Movimentação de caixa (cash_movement da MarketUP): período (padrão: últimos 7 dias), filtros,
 * lista agrupada por data com MANUAL/AUTOMÁTICO, Saldo período e Saldo atual; Adicionar novo (lançamento) e Nova transferência.
 */
export function Movimentacao() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [de, setDe] = useState(diasAtras(7));
  const [ate, setAte] = useState(hoje());
  const [filtros, setFiltros] = useState({ conta_corrente: "", conta_gerencial: "", tipo_pagamento: "", tipo: "" });
  const [dados, setDados] = useState<Resposta | null>(null);
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [gerenciais, setGerenciais] = useState<ContaGerencial[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [modal, setModal] = useState<null | "lancamento" | { transferencia: number | null }>(null);
  const [excluir, setExcluir] = useState<Movimento | null>(null);
  const [aviso, setAviso] = useState("");
  const podeAlterar = pode(ROTA_MOVIMENTACAO, "adicionar");

  useEffect(() => {
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => setContas(r.results.filter((c) => c.ativo)), () => undefined);
    api<{ results: ContaGerencial[] }>("/contas-gerenciais?page_size=200&ordering=nome").then((r) => setGerenciais(r.results.filter((g) => g.ativo)), () => undefined);
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results.filter((x) => x.ativo)), () => undefined);
  }, []);

  const carregar = useCallback(() => {
    const q = new URLSearchParams({ de, ate });
    for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
    api<Resposta>(`/movimentacao-caixa?${q}`).then(setDados, (e: ApiError) => setAviso(e.message));
  }, [de, ate, filtros]);
  useEffect(carregar, [carregar]);

  // Abrir o movimento: título (recebimento/pagamento) ou transferência.
  const abrir = (m: Movimento) => {
    if (m.transferencia) return setModal({ transferencia: m.transferencia });
    if (m.conta_receber) return navigate(`/financeiro/contas-a-receber/${m.conta_receber}`);
    if (m.conta_pagar) return navigate(`/financeiro/contas-a-pagar/${m.conta_pagar}`);
  };

  let ultimaData = "";
  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Movimentação de caixa" />
      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted"><span className="mb-1 font-label">Período de</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={controle} /></label>
        <label className="flex flex-col text-sm text-ink-muted"><span className="mb-1 font-label">Até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} /></label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Conta</span>
          <select value={filtros.conta_corrente} onChange={(e) => setFiltros((f) => ({ ...f, conta_corrente: e.target.value }))} className={controle}>
            <option value="">Todas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Conta gerencial</span>
          <select value={filtros.conta_gerencial} onChange={(e) => setFiltros((f) => ({ ...f, conta_gerencial: e.target.value }))} className={cn(controle, "max-w-48")}>
            <option value="">Todas</option>
            {gerenciais.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Pago em</span>
          <select value={filtros.tipo_pagamento} onChange={(e) => setFiltros((f) => ({ ...f, tipo_pagamento: e.target.value }))} className={cn(controle, "max-w-40")}>
            <option value="">Todos</option>
            {tipos.map((x) => <option key={x.id} value={x.id}>{x.descricao}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Tipo</span>
          <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))} className={controle}>
            <option value="">Todos</option>
            <option value="1">Crédito</option>
            <option value="-1">Débito</option>
          </select>
        </label>
        {podeAlterar && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setModal({ transferencia: null })} className="min-h-12 rounded-xs border-2 border-primary px-4 text-sm font-bold uppercase text-primary hover:bg-primary-light md:min-h-[34px]">Nova transferência</button>
            <button type="button" onClick={() => setModal("lancamento")} className="min-h-12 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark md:min-h-[34px]">Adicionar novo</button>
          </div>
        )}
      </div>

      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

      <div className="mx-auto max-w-[992px] px-4 pb-16 pt-4 xl:px-0">
        {dados && dados.results.length === 0 && <p className="py-8 text-center text-sm font-semibold uppercase text-ink-muted">Nenhum movimento no período.</p>}
        <table className="w-full text-sm">
          <tbody>
            {dados?.results.map((m) => {
              const novaData = m.data !== ultimaData;
              ultimaData = m.data;
              return (
                <Fragment key={m.id}>
                  {novaData && (
                    <tr><td colSpan={6} className="bg-secondary py-2 text-center text-sm font-bold text-surface-raised">{formatarData(m.data)}</td></tr>
                  )}
                  <tr className="border-b border-line">
                    <td className="py-3 pr-2 uppercase">{m.conta_corrente_nome}</td>
                    <td className="pr-2">
                      <span className="block uppercase">{m.descricao}</span>
                      <span className="text-[10px] uppercase text-ink-muted">({m.manual ? "manual" : "automático"})</span>
                    </td>
                    <td className="pr-2 text-xs uppercase">{m.tipo_pagamento_nome}</td>
                    <td className="pr-2 text-xs uppercase">{m.credito ? "Crédito" : "Débito"}</td>
                    <td className={cn("pr-2 text-right font-semibold tabular-nums", m.credito ? "text-primary" : "text-error")}>{Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="whitespace-nowrap text-right">
                      {(m.conta_receber || m.conta_pagar || m.transferencia) && (
                        <button type="button" onClick={() => abrir(m)} aria-label="Abrir" className="inline-flex size-12 items-center justify-center text-ink hover:bg-primary-light md:size-9"><IconPencil size={18} aria-hidden /></button>
                      )}
                      {m.manual && podeAlterar && (
                        <button type="button" onClick={() => setExcluir(m)} aria-label="Excluir" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft md:size-9"><IconTrash size={18} aria-hidden /></button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {dados && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-6 bg-line px-4 py-3">
            <span className="uppercase text-ink-muted">Saldo período <strong className="ml-2 text-lg tabular-nums text-primary">{formatarMoeda(dados.saldo_periodo)}</strong></span>
            <span className="uppercase text-ink-muted">Saldo atual <strong className="ml-2 text-lg tabular-nums text-primary">{formatarMoeda(dados.saldo_atual)}</strong></span>
          </div>
        )}
      </div>

      {modal === "lancamento" && <LancamentoModal contas={contas} gerenciais={gerenciais} tipos={tipos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />}
      {modal && typeof modal === "object" && (
        <TransferenciaModal id={modal.transferencia} contas={contas} tipos={tipos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
      {excluir && (
        <ConfirmDialog
          title="Excluir movimento"
          message="Deseja realmente excluir o registro?"
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            try {
              await api(`/movimentacao-caixa?id=${alvo.id}`, { method: "DELETE" });
              carregar();
            } catch (e) {
              setAviso(e instanceof ApiError ? e.message : "Não foi possível excluir.");
            }
          }}
        />
      )}
    </>
  );
}

/** Modal "Lançamento" da MarketUP: Pagamento / Recebimento avulso (vira um título já quitado). */
function LancamentoModal({ contas, gerenciais, tipos, onFechar, onSalvo }: { contas: ContaCorrente[]; gerenciais: ContaGerencial[]; tipos: TipoPagamento[]; onFechar: () => void; onSalvo: () => void }) {
  const principal = contas.find((c) => c.principal);
  const [d, setD] = useState({ credito: false, conta_gerencial: "" as number | "", data: hoje(), conta_corrente: (principal?.id ?? "") as number | "", valor: "0", tipo_pagamento: (tipos.find((t) => /dinheiro/i.test(t.descricao))?.id ?? "") as number | "", descricao: "" });
  const [erro, setErro] = useState("");
  const opcoes = gerenciais.filter((g) => (d.credito ? g.tipo === "E" : g.tipo === "S"));
  const salvar = async () => {
    setErro("");
    if (!(Number(d.valor) > 0)) return setErro("Informe um valor maior que zero.");
    try {
      await api("/movimentacao-caixa", { method: "POST", body: JSON.stringify({ ...d, conta_gerencial: d.conta_gerencial || null, conta_corrente: d.conta_corrente || null, tipo_pagamento: d.tipo_pagamento || null }) });
      onSalvo();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    }
  };
  return (
    <Modal titulo="Lançamento" onFechar={onFechar} largura="max-w-[560px]" rodape={<><button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button><button type="button" onClick={salvar} className={botaoConfirmar}>Salvar</button></>}>
      <div className="grid grid-cols-1 gap-3 p-1 sm:grid-cols-2">
        <div className="flex gap-2 sm:col-span-2" role="group" aria-label="Tipo">
          {[false, true].map((c) => (
            <button key={String(c)} type="button" onClick={() => setD((x) => ({ ...x, credito: c, conta_gerencial: "" }))} aria-pressed={d.credito === c} className={cn("min-h-12 flex-1 rounded-xs border-2 text-sm font-bold uppercase md:min-h-10", d.credito === c ? (c ? "border-primary bg-primary text-primary-foreground" : "border-error bg-error text-surface-raised") : "border-line text-ink")}>
              {c ? "Recebimento" : "Pagamento"}
            </button>
          ))}
        </div>
        <label className="sm:col-span-2"><span className={rotulo}>Classificação</span>
          <select data-autofocus value={d.conta_gerencial} onChange={(e) => setD((x) => ({ ...x, conta_gerencial: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">Selecione</option>
            {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Data</span><input type="date" value={d.data} onChange={(e) => setD((x) => ({ ...x, data: e.target.value }))} className={campo} /></label>
        <label><span className={rotulo}>Conta corrente</span>
          <select value={d.conta_corrente} onChange={(e) => setD((x) => ({ ...x, conta_corrente: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">Selecione</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Valor</span><CampoNumero value={d.valor} prefixo="R$ " onChange={(v) => setD((x) => ({ ...x, valor: v }))} className={cn(campo, "text-right")} /></label>
        <label><span className={rotulo}>Efetuado em</span>
          <select value={d.tipo_pagamento} onChange={(e) => setD((x) => ({ ...x, tipo_pagamento: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2"><span className={rotulo}>Descrição/observação</span><input value={d.descricao} maxLength={300} onChange={(e) => setD((x) => ({ ...x, descricao: e.target.value }))} className={campo} /></label>
        {erro && <p role="alert" className="text-sm font-semibold text-error sm:col-span-2">{erro}</p>}
      </div>
    </Modal>
  );
}

/** Modal "Transferência" da MarketUP: data, conta de origem, conta de destino, nº doc, valor, forma e observação. */
function TransferenciaModal({ id, contas, tipos, onFechar, onSalvo }: { id: number | null; contas: ContaCorrente[]; tipos: TipoPagamento[]; onFechar: () => void; onSalvo: () => void }) {
  const [d, setD] = useState({ data: hoje(), conta_origem: "" as number | "", conta_destino: "" as number | "", documento: "", valor: "0", tipo_pagamento: "" as number | "", observacao: "" });
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (id) api<typeof d>(`/transferencias?id=${id}`).then((t) => setD({ ...t, tipo_pagamento: t.tipo_pagamento ?? "" }), () => undefined);
  }, [id]);
  const salvar = async () => {
    setErro("");
    try {
      await api(id ? `/transferencias?id=${id}` : "/transferencias", { method: id ? "PUT" : "POST", body: JSON.stringify({ ...d, conta_origem: d.conta_origem || null, conta_destino: d.conta_destino || null, tipo_pagamento: d.tipo_pagamento || null }) });
      onSalvo();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    }
  };
  return (
    <Modal titulo="Transferência" onFechar={onFechar} largura="max-w-[560px]" rodape={<><button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button><button type="button" onClick={salvar} className={botaoConfirmar}>Transferência</button></>}>
      <div className="grid grid-cols-1 gap-3 p-1 sm:grid-cols-2">
        <label><span className={rotulo}>Data</span><input data-autofocus type="date" value={d.data} onChange={(e) => setD((x) => ({ ...x, data: e.target.value }))} className={campo} /></label>
        <label><span className={rotulo}>Nº doc</span><input value={d.documento} maxLength={60} onChange={(e) => setD((x) => ({ ...x, documento: e.target.value }))} className={campo} /></label>
        <label><span className={rotulo}>Conta corrente de origem</span>
          <select value={d.conta_origem} onChange={(e) => setD((x) => ({ ...x, conta_origem: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">Selecione</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Conta corrente de destino</span>
          <select value={d.conta_destino} onChange={(e) => setD((x) => ({ ...x, conta_destino: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">Selecione</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Valor</span><CampoNumero value={d.valor} prefixo="R$ " onChange={(v) => setD((x) => ({ ...x, valor: v }))} className={cn(campo, "text-right")} /></label>
        <label><span className={rotulo}>Efetuado em</span>
          <select value={d.tipo_pagamento} onChange={(e) => setD((x) => ({ ...x, tipo_pagamento: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2"><span className={rotulo}>Descrição/observação</span><input value={d.observacao} maxLength={300} onChange={(e) => setD((x) => ({ ...x, observacao: e.target.value }))} className={campo} /></label>
        {erro && <p role="alert" className="text-sm font-semibold text-error sm:col-span-2">{erro}</p>}
      </div>
    </Modal>
  );
}
