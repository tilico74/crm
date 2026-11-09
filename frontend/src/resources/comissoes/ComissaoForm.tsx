import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { FormSection, SelectField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { ROTA_COMISSOES as ROTA, type Comissao, type PedidoBusca, type Vendedor } from "./types";

type Dados = Pick<Comissao, "vendedor" | "pedido" | "emissao" | "observacao" | "valor_venda" | "percentual" | "valor"> & Partial<Comissao>;

const hoje = () => new Date().toLocaleDateString("sv-SE");
const VAZIO: Dados = { vendedor: 0, pedido: null, emissao: hoje(), observacao: "", valor_venda: "0.00", percentual: "0.00", valor: "0.00" };
const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-right text-base tabular-nums text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Lançamento de comissão (ficha "Dados gerais" da MarketUP): Comissionado · Data · Fechamento · Tipo ·
 * Venda (pedido) · Venda · % Comissão · Comissão · Observações. Comissão = venda × % ÷ 100;
 * digitando a comissão, o % é recalculado. Comissionado e data só no lançamento novo; fechado, só leitura.
 */
export function ComissaoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [pedidos, setPedidos] = useState<PedidoBusca[]>([]);

  const fechada = !!dados.fechamento;
  const podeSalvar = !fechada && pode(ROTA, editando ? "alterar" : "adicionar");
  const set = (parcial: Partial<Dados>) => setDados((d) => ({ ...d, ...parcial }));

  useEffect(() => {
    api<Vendedor[]>("/comissoes/vendedores").then(setVendedores, () => undefined);
    if (editando) api<Comissao>(`/comissoes/${id}`).then((c) => setDados(c), (e: ApiError) => setAviso(e.message));
  }, [editando, id]);

  useEffect(() => {
    if (!podeSalvar || editando || busca.trim().length < 1) return setPedidos([]);
    const t = window.setTimeout(() => api<PedidoBusca[]>(`/comissoes/pedidos?search=${encodeURIComponent(busca.trim())}`).then(setPedidos, () => setPedidos([])), 300);
    return () => window.clearTimeout(t);
  }, [busca, podeSalvar, editando]);

  // calculateCommissionValue / commissionValueChange da MarketUP (o servidor confere ao salvar).
  const mudarPercentual = (p: string) => set({ percentual: p, valor: Number(p) > 0 ? arred((Number(dados.valor_venda) * Number(p)) / 100).toFixed(2) : "0.00" });
  const mudarVenda = (v: string) => set({ valor_venda: v, valor: Number(dados.percentual) > 0 ? arred((Number(v) * Number(dados.percentual)) / 100).toFixed(2) : dados.valor });
  const mudarValor = (v: string) => set({ valor: v, percentual: Number(dados.valor_venda) > 0 && Number(v) > 0 ? arred((Number(v) / Number(dados.valor_venda)) * 100).toFixed(2) : "0.00" });

  const escolherPedido = (p: PedidoBusca) => {
    const vendedor = vendedores.find((v) => v.id === p.vendedor);
    const percentual = vendedor && (!dados.vendedor || dados.vendedor === vendedor.id) ? vendedor.comissao : dados.percentual;
    set({
      pedido: p.id, pedido_cliente: p.cliente, valor_venda: p.valor, vendedor: dados.vendedor || p.vendedor || 0, percentual,
      valor: Number(percentual) > 0 ? arred((Number(p.valor) * Number(percentual)) / 100).toFixed(2) : "0.00",
    });
    setBusca("");
    setPedidos([]);
  };

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = editando
      ? { observacao: dados.observacao, valor_venda: dados.valor_venda, percentual: dados.percentual }
      : { vendedor: dados.vendedor || null, pedido: dados.pedido, emissao: dados.emissao, observacao: dados.observacao, valor_venda: dados.valor_venda, percentual: dados.percentual };
    try {
      const salvo = await api<Comissao>(editando ? `/comissoes/${id}` : "/comissoes", { method: editando ? "PATCH" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else {
        setDados(salvo);
        setAviso("Comissão salva.");
      }
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors as Record<string, string[]>);
        setAviso(falha.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Comissões" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <FormSection title="Dados gerais">
          <SelectField
            label="Comissionado"
            required
            value={dados.vendedor || ""}
            disabled={editando || !podeSalvar}
            error={erros.vendedor}
            onChange={(e) => {
              const v = vendedores.find((x) => x.id === Number(e.target.value));
              set({ vendedor: Number(e.target.value), ...(v ? { percentual: v.comissao, valor: Number(v.comissao) > 0 ? arred((Number(dados.valor_venda) * Number(v.comissao)) / 100).toFixed(2) : "0.00" } : {}) });
            }}
            options={[{ value: "", label: "Selecione" }, ...vendedores.filter((v) => !v.bloqueado || v.id === dados.vendedor).map((v) => ({ value: v.id, label: v.nome }))]}
          />
          <TextField label="Data" type="date" required value={dados.emissao} disabled={editando || !podeSalvar} error={erros.emissao} onChange={(e) => set({ emissao: e.target.value })} />
          <TextField label="Fechamento" value={dados.data_fechamento ? formatarData(dados.data_fechamento) : ""} disabled readOnly />
          <TextField label="Tipo" value={editando ? (dados.tipo_nome ?? "") : "Manual"} disabled readOnly />

          <div className="relative sm:col-span-2">
            <span className="mb-1 block font-label text-sm text-ink-muted">Venda (pedido)</span>
            {dados.pedido ? (
              <p className="flex min-h-12 items-center gap-2 rounded-xs border border-line bg-surface px-3 text-sm md:min-h-[34px]">
                <Link to={`/vendas/pedidos/${dados.pedido}`} className="font-semibold text-primary underline">[{String(dados.pedido).padStart(6, "0")}]</Link>
                {dados.pedido_cliente}
                {!editando && podeSalvar && (
                  <button type="button" onClick={() => set({ pedido: null, pedido_cliente: null })} className="ml-auto text-xs font-semibold uppercase text-ink-muted hover:text-ink">trocar</button>
                )}
              </p>
            ) : (
              <input
                aria-label="Buscar pedido"
                placeholder={editando ? "Sem pedido" : "Número do pedido ou nome do cliente"}
                value={busca}
                disabled={editando || !podeSalvar}
                onChange={(e) => setBusca(e.target.value)}
                className="h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm"
              />
            )}
            {pedidos.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised shadow-lg">
                {pedidos.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => escolherPedido(p)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-light">
                      <span>[{String(p.id).padStart(6, "0")}] - {p.cliente}</span>
                      <span className="tabular-nums text-ink-muted">R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label>
            <span className="mb-1 block font-label text-sm text-ink-muted">Venda <span className="text-error">*</span></span>
            <CampoNumero value={dados.valor_venda} prefixo="R$ " disabled={!podeSalvar} onChange={mudarVenda} aria-invalid={!!erros.valor_venda} className={campo} />
            {erros.valor_venda && <span className="text-xs font-semibold text-error">{erros.valor_venda.join(" ")}</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block font-label text-sm text-ink-muted">% Comissão</span>
              <CampoNumero value={dados.percentual} disabled={!podeSalvar} onChange={mudarPercentual} className={campo} />
            </label>
            <label>
              <span className="mb-1 block font-label text-sm text-ink-muted">Comissão</span>
              <CampoNumero value={dados.valor} prefixo="R$ " disabled={!podeSalvar} onChange={mudarValor} aria-invalid={!!erros.valor} className={cn(campo, "font-semibold")} />
            </label>
            {erros.valor && <span className="col-span-2 text-xs font-semibold text-error">{erros.valor.join(" ")}</span>}
          </div>
          <TextField label="Observações" span={4} maxLength={300} value={dados.observacao} disabled={!podeSalvar} onChange={(e) => set({ observacao: e.target.value })} />
        </FormSection>
        {fechada && <p className="mt-4 text-sm text-ink-muted">Lançamento fechado no fechamento Nº {dados.fechamento}: só leitura.</p>}
        <p className="mt-4 text-xs text-ink-muted">A comissão automática nasce ao concluir o pedido: (total do pedido − frete) × % do vendedor.</p>

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}
