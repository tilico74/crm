import { IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { CampoNumero, numeroBr } from "@/components/CampoNumero";
import { botaoCancelar, botaoConfirmar, Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { ContaCorrente, TipoPagamento } from "@/resources/financeiro/types";

import type { ItemCompra, PedidoCompra } from "./pedidos";

const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const rotulo = "text-[11px] font-semibold uppercase text-primary";
const hoje = () => new Date().toLocaleDateString("sv-SE");
type Local = { id: number; nome: string; padrao: boolean; ativo: boolean };

function useLocais() {
  const [locais, setLocais] = useState<Local[]>([]);
  useEffect(() => {
    api<Local[] | { results: Local[] }>("/locais-estoque").then((r) => setLocais((Array.isArray(r) ? r : r.results).filter((l) => l.ativo)), () => undefined);
  }, []);
  return locais;
}

function useContasCorrentes() {
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  useEffect(() => {
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => setContas(r.results.filter((c) => c.ativo)), () => undefined);
  }, []);
  return contas;
}

function SeletorLocal({ locais, valor, onChange }: { locais: Local[]; valor: number | ""; onChange: (v: number | "") => void }) {
  return (
    <select aria-label="Local de estoque" value={valor} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")} className={campo}>
      {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
    </select>
  );
}

const pendente = (i: ItemCompra) => Number(i.quantidade) - Number(i.recebido ?? 0);

/**
 * "RECEBER PEDIDO" (PurchaseOrderReceiveController): "Selecione o local de estoque e verifique os itens pendentes para
 * recebimento." Local · Data de recebimento · Dados fiscais (Nº NF-e, Série, Data de emissão) · Observações · e, por item
 * pendente: pedido / recebido, Receber (até o que falta), Lote e Validade; a lixeira tira o item deste recebimento.
 */
export function ReceberCompraModal({ pedido, onFechar, onConfirmar }: {
  pedido: PedidoCompra;
  onFechar: () => void;
  onConfirmar: (corpo: object) => void;
}) {
  const locais = useLocais();
  const [local, setLocal] = useState<number | "">("");
  const [data, setData] = useState(hoje());
  const [nota, setNota] = useState({ numero: pedido.nota_numero, serie: pedido.nota_serie, emissao: pedido.nota_emissao ?? "" });
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState(
    pedido.itens.filter((i) => i.id && pendente(i) > 0).map((i) => ({ item: i, quantidade: String(pendente(i)), lote: i.lote ?? "", validade: i.validade ?? "" })),
  );
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!local && locais.length) setLocal(locais.find((l) => l.padrao)?.id ?? locais[0].id);
  }, [locais, local]);
  const mudar = (n: number, parcial: Partial<(typeof linhas)[number]>) => setLinhas((l) => l.map((x, i) => (i === n ? { ...x, ...parcial } : x)));

  const confirmar = () => {
    if (!data) return setErro("Informe a data de recebimento.");
    for (const l of linhas) {
      if (Number(l.quantidade) > pendente(l.item)) return setErro(`${l.item.descricao}: a quantidade a receber passa do que falta receber.`);
      if (l.validade && l.validade <= hoje()) return setErro(`${l.item.descricao}: a validade tem que ser uma data futura.`);
    }
    if (!linhas.some((l) => Number(l.quantidade) > 0)) return onFechar();
    onConfirmar({
      local: local || null, data, nota_numero: nota.numero, nota_serie: nota.serie, nota_emissao: nota.emissao || null, observacao,
      itens: linhas.map((l) => ({ item: l.item.id, quantidade: l.quantidade || "0", lote: l.lote, validade: l.validade || null })),
    });
  };

  return (
    <Modal
      titulo="Receber pedido"
      onFechar={onFechar}
      largura="max-w-[960px]"
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button>
          <button type="button" onClick={confirmar} className={botaoConfirmar}>Receber pedido</button>
        </>
      }
    >
      <p className="px-1 pb-3 text-sm uppercase text-ink">Selecione o local de estoque e verifique os itens pendentes para recebimento.</p>
      {erro && <p role="alert" className="mb-2 rounded-xs bg-error-soft px-3 py-2 text-sm font-semibold text-error">{erro}</p>}
      <div className="grid grid-cols-1 gap-3 px-1 sm:grid-cols-2">
        <label><span className={rotulo}>Local de estoque</span><SeletorLocal locais={locais} valor={local} onChange={setLocal} /></label>
        <label><span className={rotulo}>Data de recebimento</span><input type="date" data-autofocus value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
      </div>
      <h3 className="mt-4 border-b border-line px-1 pb-1 text-sm font-semibold uppercase text-ink">Dados fiscais</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 px-1 sm:grid-cols-3">
        <label><span className={rotulo}>Nº NF-e</span><input value={nota.numero} maxLength={20} onChange={(e) => setNota({ ...nota, numero: e.target.value })} className={campo} /></label>
        <label><span className={rotulo}>Série</span><input value={nota.serie} maxLength={5} onChange={(e) => setNota({ ...nota, serie: e.target.value })} className={campo} /></label>
        <label><span className={rotulo}>Data de emissão</span><input type="date" value={nota.emissao} onChange={(e) => setNota({ ...nota, emissao: e.target.value })} className={campo} /></label>
        <label className="sm:col-span-3"><span className={rotulo}>Observações</span><input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} /></label>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink">
              <th className="px-2 py-2">Produto/Serviço</th><th className="px-2 py-2">Quantidade</th><th className="w-28 px-2 py-2 text-right">Receber</th>
              <th className="w-28 px-2 py-2">Lote</th><th className="w-36 px-2 py-2">Validade</th><th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, n) => (
              <tr key={l.item.id} className="border-b border-line">
                <td className="px-2 py-2">
                  <span className="block text-[11px] tabular-nums text-ink-muted">{l.item.codigo_barras || "sem código"}</span>
                  {l.item.descricao}
                  {l.item.movimenta_estoque === false && <span className="block text-[11px] text-ink-muted">Não movimenta estoque</span>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums">
                  pedido: {numeroBr(l.item.quantidade, 3)}<br />recebido: {numeroBr(l.item.recebido ?? 0, 3)} {l.item.unidade_sigla}
                </td>
                <td className="px-2 py-2"><CampoNumero aria-label={`Receber ${l.item.descricao}`} casas={3} value={l.quantidade} onChange={(v) => mudar(n, { quantidade: v })} className={cn(campo, "text-right")} /></td>
                <td className="px-2 py-2"><input aria-label={`Lote de ${l.item.descricao}`} value={l.lote} maxLength={40} onChange={(e) => mudar(n, { lote: e.target.value })} className={campo} /></td>
                <td className="px-2 py-2"><input type="date" aria-label={`Validade de ${l.item.descricao}`} value={l.validade} onChange={(e) => mudar(n, { validade: e.target.value })} className={campo} /></td>
                <td className="text-center">
                  <button type="button" onClick={() => setLinhas((x) => x.filter((_, i) => i !== n))} aria-label={`Não receber ${l.item.descricao} agora`} className="inline-flex size-10 items-center justify-center text-ink-muted hover:text-error">
                    <IconTrash size={20} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="py-4 text-center text-sm uppercase text-ink-muted">Nenhum item pendente para recebimento.</p>}
      </div>
    </Modal>
  );
}

/**
 * "DEVOLUÇÃO / TROCA" (ModalReturnItemsPurchaseOrderController): por item recebido, Trocar e Devolver; "Produtos devolvidos";
 * Saldo pedido · Valor pago · Valor estorno · Data estorno · Estornar em. O valor devolvido (qtd × total ÷ qtd do item) abate o
 * saldo em aberto; o que passar disso é o estorno (entra no caixa).
 */
export function DevolucaoCompraModal({ pedido, tipos, onFechar, onConfirmar }: {
  pedido: PedidoCompra;
  tipos: TipoPagamento[];
  onFechar: () => void;
  onConfirmar: (corpo: object) => void;
}) {
  const contas = useContasCorrentes();
  const locais = useLocais();
  const [local, setLocal] = useState<number | "">("");
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState<number | "">(tipos.find((t) => /dinheiro/i.test(t.descricao))?.id ?? "");
  const [conta, setConta] = useState<number | "">("");
  const [erro, setErro] = useState("");
  const recebidos = pedido.itens.filter((i) => i.id && Number(i.quantidade) > Number(i.devolvido ?? 0) && Number(i.recebido ?? 0) > 0);
  const devolvidos = pedido.itens.filter((i) => Number(i.devolvido ?? 0) > 0);
  const [qtd, setQtd] = useState<Record<number, { trocar: string; devolver: string }>>({});
  useEffect(() => {
    if (!local && locais.length) setLocal(locais.find((l) => l.padrao)?.id ?? locais[0].id);
  }, [locais, local]);

  const unitario = (i: ItemCompra) => Math.round((Number(i.total) / Number(i.quantidade)) * 100) / 100;
  const valorDevolvido = recebidos.reduce((s, i) => s + Math.round(Number(qtd[i.id!]?.devolver || 0) * unitario(i) * 100) / 100, 0);
  const saldo = Number(pedido.saldo_pagar ?? 0);
  const estorno = Math.max(0, Math.round((valorDevolvido - saldo) * 100) / 100);

  const mudar = (i: ItemCompra, campoQtd: "trocar" | "devolver", v: string) => {
    const atual = { ...{ trocar: "0", devolver: "0" }, ...qtd[i.id!], [campoQtd]: v };
    if (campoQtd === "trocar" && Number(v) > Number(i.recebido ?? 0)) return setErro("A quantidade disponível para troca é a quantidade recebida do item.");
    if (Number(atual.trocar) + Number(atual.devolver) > Number(i.quantidade)) return setErro("As quantidades informadas excedem quantidade do item.");
    setErro("");
    setQtd({ ...qtd, [i.id!]: atual });
  };
  const confirmar = () => {
    const itens = recebidos
      .map((i) => ({ item: i.id, devolver: qtd[i.id!]?.devolver || "0", trocar: qtd[i.id!]?.trocar || "0" }))
      .filter((x) => Number(x.devolver) > 0 || Number(x.trocar) > 0);
    if (!itens.length) return onFechar();
    if (estorno > 0 && !conta) return setErro("Informe a conta corrente onde entra o valor estornado.");
    onConfirmar({ data, tipo_pagamento: forma || null, conta_corrente: conta || null, local: local || null, itens });
  };

  return (
    <Modal
      titulo="Devolução / troca"
      onFechar={onFechar}
      largura="max-w-[900px]"
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button>
          <button type="button" onClick={confirmar} className={botaoConfirmar}>Confirmar</button>
        </>
      }
    >
      {erro && <p role="alert" className="mb-2 rounded-xs bg-error-soft px-3 py-2 text-sm font-semibold text-error">{erro}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-ink">
              <th className="px-2 py-2">Produto</th><th className="px-2 py-2">Quantidades</th><th className="w-28 px-2 py-2 text-right">Trocar</th><th className="w-28 px-2 py-2 text-right">Devolver</th>
            </tr>
          </thead>
          <tbody>
            {recebidos.map((i) => (
              <tr key={i.id} className="border-b border-line">
                <td className="px-2 py-2"><span className="block text-[11px] tabular-nums text-ink-muted">{i.codigo_barras || "sem código"}</span>{i.descricao}</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums">
                  pedido: {numeroBr(i.quantidade, 3)}<br />recebido: {numeroBr(i.recebido ?? 0, 3)}<br />devolvida: {numeroBr(i.devolvido ?? 0, 3)} {i.unidade_sigla}
                </td>
                <td className="px-2 py-2"><CampoNumero aria-label={`Trocar ${i.descricao}`} casas={3} value={qtd[i.id!]?.trocar ?? "0"} onChange={(v) => mudar(i, "trocar", v)} className={cn(campo, "text-right")} /></td>
                <td className="px-2 py-2"><CampoNumero aria-label={`Devolver ${i.descricao}`} casas={3} value={qtd[i.id!]?.devolver ?? "0"} onChange={(v) => mudar(i, "devolver", v)} className={cn(campo, "text-right")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {recebidos.length === 0 && <p className="py-4 text-center text-sm uppercase text-ink-muted">Nenhum item recebido para devolver.</p>}
      </div>
      {devolvidos.length > 0 && (
        <>
          <h3 className="mt-4 border-b border-line px-1 pb-1 text-sm font-semibold uppercase text-ink">Produtos devolvidos</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-ink-muted"><th className="px-2 py-1">Produto</th><th className="px-2 py-1">Quantidades</th><th className="px-2 py-1">Data</th><th className="px-2 py-1 text-right">Valor</th></tr></thead>
            <tbody>
              {devolvidos.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-2 py-1">{i.descricao}</td>
                  <td className="px-2 py-1 text-xs tabular-nums">pedido: {numeroBr(i.quantidade, 3)} · devolvida: {numeroBr(i.devolvido ?? 0, 3)}</td>
                  <td className="px-2 py-1 tabular-nums">{formatarData(i.data_devolucao ?? null)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatarMoeda(i.valor_devolvido ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="mt-4 grid grid-cols-1 gap-3 px-1 sm:grid-cols-3">
        <label><span className={rotulo}>Saldo pedido</span><input readOnly value={formatarMoeda(saldo)} className={cn(campo, "bg-surface text-right")} /></label>
        <label><span className={rotulo}>Valor pago</span><input readOnly value={formatarMoeda(pedido.valor_pago ?? 0)} className={cn(campo, "bg-surface text-right")} /></label>
        <label><span className={rotulo}>Valor devolvido</span><input readOnly value={formatarMoeda(valorDevolvido)} className={cn(campo, "bg-surface text-right")} /></label>
        <label><span className={rotulo}>Valor estorno</span><input readOnly value={formatarMoeda(estorno)} className={cn(campo, "bg-surface text-right")} /></label>
        <label><span className={rotulo}>Data estorno</span><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} /></label>
        <label>
          <span className={rotulo}>Estornar em</span>
          <select value={forma} onChange={(e) => setForma(e.target.value ? Number(e.target.value) : "")} className={campo}>
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={rotulo}>Conta corrente{estorno > 0 ? " *" : ""}</span>
          <select value={conta} onChange={(e) => setConta(e.target.value ? Number(e.target.value) : "")} className={campo}>
            <option value="">—</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Sai do local</span><SeletorLocal locais={locais} valor={local} onChange={setLocal} /></label>
      </div>
    </Modal>
  );
}

/**
 * Cancelar pedido com valor pago ou itens recebidos (modal de cancelamento da MarketUP): quanto estornar, data, forma,
 * conta corrente onde o estorno entra e o local de estoque de onde saem os itens recebidos.
 */
export function CancelarCompraModal({ numero, pago, itensRecebidos, tipos, onFechar, onConfirmar }: {
  numero: number;
  pago: number;
  itensRecebidos: number;
  tipos: TipoPagamento[];
  onFechar: () => void;
  onConfirmar: (corpo: object) => void;
}) {
  const contas = useContasCorrentes();
  const locais = useLocais();
  const [valor, setValor] = useState(pago.toFixed(2));
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState<number | "">(tipos.find((t) => /dinheiro/i.test(t.descricao))?.id ?? "");
  const [conta, setConta] = useState<number | "">("");
  const [local, setLocal] = useState<number | "">("");
  useEffect(() => {
    if (!local && locais.length) setLocal(locais.find((l) => l.padrao)?.id ?? locais[0].id);
  }, [locais, local]);
  return (
    <Modal
      titulo={`Cancelar pedido ${numero}`}
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Fechar</button>
          <button
            type="button"
            onClick={() => onConfirmar({ valor_estorno: pago > 0 ? valor : "0", data, tipo_pagamento: forma || null, conta_corrente: conta || null, local: local || null })}
            className="min-h-12 min-w-24 bg-error px-4 text-sm font-semibold uppercase text-surface-raised hover:opacity-90 md:min-h-10"
          >
            Cancelar pedido
          </button>
        </>
      }
    >
      <p className="px-1 pb-3 text-sm text-ink">
        {pago > 0 && <>Este pedido já tem <strong>{formatarMoeda(pago)}</strong> pagos ao fornecedor: o valor estornado entra no caixa. </>}
        {itensRecebidos > 0 && <>Os itens já recebidos saem do estoque. </>}
        As contas a pagar saem do financeiro. Esta operação não poderá ser desfeita!
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pago > 0 && (
          <>
            <label><span className={rotulo}>Valor pago</span><input readOnly value={formatarMoeda(pago)} className={cn(campo, "bg-surface text-right")} /></label>
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
              <span className={rotulo}>Conta corrente *</span>
              <select value={conta} onChange={(e) => setConta(e.target.value ? Number(e.target.value) : "")} className={campo}>
                <option value="">—</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </>
        )}
        {itensRecebidos > 0 && (
          <label className="sm:col-span-2"><span className={rotulo}>Local de estoque (saída dos itens recebidos)</span><SeletorLocal locais={locais} valor={local} onChange={setLocal} /></label>
        )}
      </div>
    </Modal>
  );
}
