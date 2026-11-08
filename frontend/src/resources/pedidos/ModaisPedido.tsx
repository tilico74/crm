import { IconFileInvoice, IconSearch, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { botaoCancelar, botaoConfirmar, Modal } from "@/components/Modal";
import { CampoNumero } from "@/components/CampoNumero";
import { api, ApiError } from "@/lib/api";
import { reaisPorExtenso } from "@/lib/extenso";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { ContaCorrente, TipoPagamento } from "@/resources/financeiro/types";

import type { ContaReceber, ParcelaPedido, Recibo } from "./types";

const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const rotulo = "text-[11px] font-semibold uppercase text-primary";
const hoje = () => new Date().toLocaleDateString("sv-SE");
const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function useContasCorrentes() {
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  useEffect(() => {
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => setContas(r.results.filter((c) => c.ativo)), () => undefined);
  }, []);
  return contas;
}

/**
 * "Efetuar recebimento" da conta a receber da parcela (painel da tela receivable/detail da MarketUP):
 * data, conta corrente, juros (+), descontos (−), valor recebido (=) e forma; embaixo, o histórico
 * de recebimentos com o X vermelho que estorna. A tela completa de contas a receber vem na T302.
 */
export function ReceberModal({ contaId, tipos, onFechar, onMudou }: { contaId: number; tipos: TipoPagamento[]; onFechar: () => void; onMudou: () => void }) {
  const contas = useContasCorrentes();
  const [conta, setConta] = useState<ContaReceber | null>(null);
  const [data, setData] = useState(hoje());
  const [contaCorrente, setContaCorrente] = useState<number | "">("");
  const [juros, setJuros] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [valor, setValor] = useState<string | null>(null);
  const [forma, setForma] = useState<number | "">("");
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);

  const carregar = () =>
    api<ContaReceber>(`/contas-receber/${contaId}`).then((c) => {
      setConta(c);
      setForma((f) => f || c.tipo_pagamento || "");
      setValor(null);
      setJuros("0");
      setDesconto("0");
    });
  useEffect(() => {
    carregar().catch((e: ApiError) => setErro(e.message));
  }, [contaId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!contaCorrente && contas.length) setContaCorrente(contas.find((c) => c.principal)?.id ?? contas[0].id);
  }, [contas, contaCorrente]);

  if (!conta) return <Modal titulo="Efetuar recebimento" onFechar={onFechar}><p className="p-4 text-ink-muted">{erro || "Carregando…"}</p></Modal>;

  // Valor recebido sugerido = saldo + juros − desconto (como o "=" da MarketUP).
  const sugerido = arred(Number(conta.saldo) + Number(juros || 0) - Number(desconto || 0));
  const recebido = valor ?? String(sugerido);

  const receber = async () => {
    setGravando(true);
    setErro("");
    try {
      await api(`/contas-receber/${contaId}/receber`, {
        method: "POST",
        body: JSON.stringify({ data, valor: recebido, juros, desconto, tipo_pagamento: forma || null, conta_corrente: contaCorrente || null }),
      });
      await carregar();
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível receber.");
    } finally {
      setGravando(false);
    }
  };
  const estornar = async (id: number) => {
    if (!window.confirm("Estornar este recebimento? O valor volta a ficar em aberto e o caixa recebe a saída.")) return;
    try {
      await api(`/contas-receber/${contaId}/recebimentos/${id}/estornar`, { method: "POST" });
      await carregar();
      onMudou();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível estornar.");
    }
  };

  const aberta = Number(conta.saldo) > 0 && !conta.cancelada;
  return (
    <Modal titulo="Efetuar recebimento" onFechar={onFechar} largura="max-w-[860px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-1 pb-3">
        <div>
          <p className="text-lg text-ink">{conta.descricao} <span className="text-sm text-ink-muted">· parcela {conta.parcela}/{conta.parcelas}</span></p>
          <p className="text-sm text-ink-muted">Sacado: {conta.cliente_nome} · vencimento {formatarData(conta.vencimento)}</p>
        </div>
        <p className="text-right">
          <span className="block text-[11px] uppercase text-ink-muted">Valor · Saldo</span>
          <span className="text-lg tabular-nums">{formatarMoeda(conta.valor)} · <strong className={Number(conta.saldo) > 0 ? "text-primary" : "text-success"}>{formatarMoeda(conta.saldo)}</strong></span>
        </p>
      </div>

      {aberta && (
        <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-3">
          <label><span className={rotulo}>Data</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
          <label>
            <span className={rotulo}>Conta corrente</span>
            <select value={contaCorrente} onChange={(e) => setContaCorrente(e.target.value ? Number(e.target.value) : "")} className={campo}>
              <option value="">—</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>
            <span className={rotulo}>Efetuado em</span>
            <select value={forma} onChange={(e) => setForma(e.target.value ? Number(e.target.value) : "")} className={campo}>
              <option value="">—</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
            </select>
          </label>
          <label><span className={rotulo}>Juros (+)</span><CampoNumero value={juros} prefixo="R$ " onChange={(v) => { setJuros(v); setValor(null); }} className={cn(campo, "text-right")} /></label>
          <label><span className={rotulo}>Descontos (−)</span><CampoNumero value={desconto} prefixo="R$ " onChange={(v) => { setDesconto(v); setValor(null); }} className={cn(campo, "text-right")} /></label>
          <label><span className={rotulo}>Valor recebido (=)</span><CampoNumero data-autofocus value={recebido} prefixo="R$ " onChange={setValor} className={cn(campo, "text-right font-bold")} /></label>
          <div className="sm:col-span-3 flex justify-end">
            <button type="button" onClick={receber} disabled={gravando} className={botaoConfirmar}>{gravando ? "Gravando…" : "Incluir recebimento"}</button>
          </div>
        </div>
      )}
      {erro && <p role="alert" className="px-1 pb-2 text-sm font-semibold text-error">{erro}</p>}

      <h3 className="mt-2 border-b border-line pb-1 text-sm font-semibold uppercase text-ink">Histórico de recebimentos</h3>
      {conta.recebimentos.length === 0 ? (
        <p className="py-3 text-sm text-ink-muted">Nenhum recebimento.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-muted">
              <th className="py-2">Data</th><th className="text-right">Recebido</th><th className="text-right">Desconto</th><th className="text-right">Juros</th><th className="pl-3">Forma</th><th>Conta</th><th />
            </tr>
          </thead>
          <tbody>
            {conta.recebimentos.map((r) => (
              <tr key={r.id} className={cn("border-t border-line", r.estornado_em && "text-ink-muted line-through")}>
                <td className="py-2 tabular-nums">{formatarData(r.data)}</td>
                <td className="text-right tabular-nums">{formatarMoeda(r.valor)}</td>
                <td className="text-right tabular-nums">{formatarMoeda(r.desconto)}</td>
                <td className="text-right tabular-nums">{formatarMoeda(r.juros)}</td>
                <td className="pl-3">{r.tipo_pagamento_nome ?? "—"}</td>
                <td>{r.conta_corrente_nome ?? "—"}</td>
                <td className="text-right">
                  {!r.estornado_em && !conta.cancelada && (
                    <button type="button" onClick={() => estornar(r.id)} aria-label="Estornar recebimento" title="Estornar" className="inline-flex size-10 items-center justify-center text-error hover:scale-110">
                      <IconX size={22} stroke={3} aria-hidden />
                    </button>
                  )}
                  {r.estornado_em && <span className="text-xs no-underline">estornado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/**
 * "EMITIR RECIBO" (showDocket da MarketUP): recebi(emos) de, data, subtotal, juros, desconto,
 * valor total, importância por extenso, "Referente a: PEDIDO X - PARCELA n / N" e a assinatura.
 * Imprimir abre o recibo numa aba para imprimir ou salvar em PDF; o envio por e-mail fica para depois.
 */
export function ReciboModal({ contaId, onFechar }: { contaId: number; onFechar: () => void }) {
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api<Recibo>(`/contas-receber/${contaId}/recibo`).then(setRecibo, (e: ApiError) => setErro(e.message));
  }, [contaId]);

  return (
    <Modal
      titulo="Emitir recibo"
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Cancelar</button>
          <button type="button" disabled title="Envio por e-mail: chega com a configuração de e-mail" className={cn(botaoCancelar, "opacity-50")}>Enviar</button>
          <a href={`/vendas/recibos/${contaId}/imprimir`} target="_blank" rel="noreferrer" data-autofocus className={cn(botaoConfirmar, "inline-flex items-center justify-center", !recibo && "pointer-events-none opacity-50")}>
            Imprimir
          </a>
        </>
      }
    >
      {erro && <p role="alert" className="p-2 text-sm font-semibold text-error">{erro}</p>}
      {recibo && (
        <div className="grid grid-cols-1 gap-3 p-1 text-sm sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={rotulo}>Enviar para</span><input readOnly value={recibo.email} className={campo} /></label>
          <p className="sm:col-span-2"><span className={rotulo}>Recebi(emos) de</span><br /><strong className="text-lg">{recibo.recebi_de}</strong></p>
          <p><span className={rotulo}>Data</span><br />{formatarData(recibo.data)}</p>
          <div className="grid grid-cols-2 gap-x-3 tabular-nums">
            <span className="text-ink-muted">Subtotal</span><span className="text-right">{formatarMoeda(recibo.subtotal)}</span>
            <span className="text-ink-muted">Juros</span><span className="text-right">{formatarMoeda(recibo.juros)}</span>
            <span className="text-ink-muted">Desconto</span><span className="text-right">{formatarMoeda(recibo.desconto)}</span>
            <strong>Valor total</strong><strong className="text-right text-primary">{formatarMoeda(recibo.total)}</strong>
          </div>
          <p className="sm:col-span-2"><span className={rotulo}>Importância por extenso</span><br />{reaisPorExtenso(recibo.total)}</p>
          <p className="sm:col-span-2"><span className={rotulo}>Referente a</span><br />{recibo.referente}</p>
          <p className="sm:col-span-2"><span className={rotulo}>Assinatura</span><br />{recibo.assinatura}</p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Cancelar pedido com valor já recebido (modal do doCancel da MarketUP): quanto estornar,
 * em que data e em que forma; as contas a receber saem e o valor estornado sai do caixa.
 */
export function CancelarPedidoModal({ numero, recebido, tipos, onFechar, onConfirmar }: {
  numero: number;
  recebido: number;
  tipos: TipoPagamento[];
  onFechar: () => void;
  onConfirmar: (dados: { valor_estorno: string; data: string; tipo_pagamento: number | null; conta_corrente: number | null }) => void;
}) {
  const contas = useContasCorrentes();
  const [valor, setValor] = useState(recebido.toFixed(2));
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState<number | "">(tipos.find((t) => /dinheiro/i.test(t.descricao))?.id ?? "");
  const [conta, setConta] = useState<number | "">("");
  return (
    <Modal
      titulo={`Cancelar pedido ${numero}`}
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button>
          <button
            type="button"
            onClick={() => onConfirmar({ valor_estorno: valor, data, tipo_pagamento: forma || null, conta_corrente: conta || null })}
            className="min-h-12 min-w-24 bg-error px-4 text-sm font-semibold uppercase text-surface-raised hover:opacity-90 md:min-h-10"
          >
            Cancelar pedido
          </button>
        </>
      }
    >
      <p className="px-1 pb-3 text-sm text-ink">
        Este pedido já tem <strong>{formatarMoeda(recebido)}</strong> recebidos. Ao cancelar, as contas a receber saem do financeiro e o valor estornado sai do caixa. Esta operação não poderá ser desfeita!
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label><span className={rotulo}>Valor recebido</span><input readOnly value={formatarMoeda(recebido)} className={cn(campo, "bg-surface text-right")} /></label>
        <label><span className={rotulo}>Valor estorno</span><CampoNumero data-autofocus value={valor} prefixo="R$ " onChange={setValor} className={cn(campo, "text-right")} /></label>
        <label><span className={rotulo}>Data estorno</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
        <label>
          <span className={rotulo}>Estornar em</span>
          <select value={forma} onChange={(e) => setForma(e.target.value ? Number(e.target.value) : "")} className={campo}>
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={rotulo}>Conta corrente</span>
          <select value={conta} onChange={(e) => setConta(e.target.value ? Number(e.target.value) : "")} className={campo}>
            <option value="">—</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  );
}

/** "Entregar pedido": data da entrega. O local de estoque e a baixa dos itens chegam com a T301. */
export function EntregarModal({ numero, onFechar, onConfirmar }: { numero: number; onFechar: () => void; onConfirmar: (data: string) => void }) {
  const [data, setData] = useState(hoje());
  return (
    <Modal
      titulo="Entregar pedido"
      onFechar={onFechar}
      largura="max-w-[480px]"
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button>
          <button type="button" onClick={() => onConfirmar(data)} className={botaoConfirmar}>Entregar pedido</button>
        </>
      }
    >
      <p className="px-1 pb-3 text-sm text-ink">Confirme a entrega de todos os itens do pedido {numero}.</p>
      <label className="block px-1"><span className={rotulo}>Data de entrega</span><input type="date" data-autofocus value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
    </Modal>
  );
}

/**
 * Pagamento do pedido concluído (MarketUP): Parcela · Vencimento (observações) · Valor · Saldo,
 * "Valor pendente de pagamento" e, em cada parcela, RECIBO, RECEBER e a lupa da conta.
 */
export function PagamentoFaturado({ parcelas, pendente, podeReceber, onRecibo, onReceber }: {
  parcelas: ParcelaPedido[];
  pendente: number;
  podeReceber: boolean;
  onRecibo: (conta: number) => void;
  onReceber: (conta: number) => void;
}) {
  if (parcelas.length === 0) return <p className="bg-surface p-4 text-sm text-ink-muted">Sem parcelas (pedido cancelado: as contas a receber foram retiradas).</p>;
  return (
    <div className="bg-surface">
      <div className="hidden grid-cols-[5rem_1fr_9rem_9rem_17rem] gap-3 bg-line px-4 py-3 text-xs font-semibold uppercase text-ink md:grid">
        <span>Parcela</span><span>Vencimento</span><span className="text-right">Valor (R$)</span><span className="text-right">Saldo (R$)</span><span />
      </div>
      {parcelas.map((p, n) => {
        const recebido = Number(p.valor) - Number(p.saldo ?? p.valor) > 0;
        return (
          <div key={p.id ?? n} className="grid grid-cols-2 items-center gap-3 border-b border-line px-4 py-3 md:grid-cols-[5rem_1fr_9rem_9rem_17rem]">
            <span className="text-sm text-primary">[{p.numero}/{p.quantidade}]</span>
            <span className="text-sm">
              <span className="tabular-nums">{formatarData(p.vencimento)}</span> · {p.tipo_pagamento_nome}
              {p.descricao && <span className="block text-xs text-ink-muted">{p.descricao}</span>}
            </span>
            <span className="text-right tabular-nums">{formatarMoeda(p.valor)}</span>
            <span className={cn("text-right font-semibold tabular-nums", Number(p.saldo) > 0 ? "text-ink" : "text-success")}>{formatarMoeda(p.saldo ?? p.valor)}</span>
            <span className="col-span-2 flex justify-end gap-2 md:col-span-1">
              <button type="button" disabled={!p.conta_receber || !recebido} onClick={() => p.conta_receber && onRecibo(p.conta_receber)} className="inline-flex min-h-10 items-center gap-1 rounded-xs border-2 border-primary px-3 text-xs font-bold uppercase text-primary hover:bg-primary-light disabled:opacity-40">
                <IconFileInvoice size={16} aria-hidden /> Recibo
              </button>
              <button type="button" disabled={!p.conta_receber || !podeReceber || Number(p.saldo) <= 0} onClick={() => p.conta_receber && onReceber(p.conta_receber)} className="min-h-10 rounded-xs bg-primary px-3 text-xs font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-40">
                Receber
              </button>
              <button type="button" disabled={!p.conta_receber} onClick={() => p.conta_receber && onReceber(p.conta_receber)} aria-label={`Ver a conta a receber da parcela ${p.numero}`} title="Ver a conta a receber" className="inline-flex size-10 items-center justify-center text-primary hover:bg-primary-light disabled:opacity-40">
                <IconSearch size={20} aria-hidden />
              </button>
            </span>
          </div>
        );
      })}
      <div className="flex justify-end px-4 py-3">
        <span className="text-right">
          <span className="block text-[11px] uppercase text-primary">Valor pendente de pagamento (R$)</span>
          <span className="text-2xl tabular-nums text-primary">{formatarMoeda(pendente)}</span>
        </span>
      </div>
    </div>
  );
}
