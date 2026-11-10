import { useList } from "@refinedev/core";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { SelectField, SwitchField, TextField } from "@/components/form";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { ROTA_ESTOQUE, type Local, type TipoEstocagem } from "./types";

const ROTA = ROTA_ESTOQUE.locais;
const dataHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const COLUNAS: Column<Local>[] = [
  { header: "Nome", cell: (l) => <span className="uppercase">{l.nome}{l.em_inventario ? <span className="ml-2 rounded-xs bg-warning px-1 text-[10px] font-bold text-black">em inventário</span> : null}</span> },
  { header: "Tipo estocagem", cell: (l) => l.tipo_nome, className: "md:w-44" },
  { header: "Padrão", cell: (l) => (l.padrao ? "Sim" : "Não"), className: "md:w-24" },
  { header: "Ativo", cell: (l) => (l.ativo ? "Sim" : "Não"), className: "md:w-24" },
];

/** Estoque › Locais de estoque (stock_location da MarketUP). */
export function LocaisList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [excluir, setExcluir] = useState<Local | null>(null);
  const [aviso, setAviso] = useState("");
  const { result, query } = useList<Local>({ resource: "locais-estoque", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });
  return (
    <>
      <PageHeader eyebrow="Estoque" title="Locais de estoque">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA, "adicionar") ? () => navigate(`${ROTA}/novo`) : undefined} />
      </PageHeader>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        loading={query.isLoading}
        onEdit={(l) => navigate(`${ROTA}/${l.id}`)}
        onDelete={pode(ROTA, "excluir") ? setExcluir : undefined}
        canDelete={(l) => !l.sistema}
        empty="Nenhum local cadastrado."
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir local"
          message={`Deseja realmente excluir o local "${excluir.nome}"?`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            try {
              await api(`/locais-estoque/${alvo.id}`, { method: "DELETE" });
              await query.refetch();
            } catch (e) {
              setAviso(e instanceof ApiError ? e.message : "Não foi possível excluir.");
            }
          }}
        />
      )}
    </>
  );
}

type ItemEstoque = { produto: number; codigo: string; descricao: string; unidade: string; quantidade: string };
type InventarioResumo = { id: number; status: number; status_nome: string; inicio: string; fim: string | null; movimentacao: number | null };

/** Ficha do local: Nome · Tipo de estocagem · Ativo · Padrão; abas Estoque atual e Inventários (Inventariar estoque). */
export function LocalForm() {
  const { id } = useParams();
  const novo = id === "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [dados, setDados] = useState<Partial<Local>>({ nome: "", tipo: 1, ativo: true, padrao: false });
  const [tipos, setTipos] = useState<TipoEstocagem[]>([]);
  const [aba, setAba] = useState<"estoque" | "inventarios">("estoque");
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [busca, setBusca] = useState("");
  const [inventarios, setInventarios] = useState<InventarioResumo[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const podeSalvar = pode(ROTA, novo ? "adicionar" : "alterar");

  useEffect(() => {
    api<TipoEstocagem[] | { results: TipoEstocagem[] }>("/tipos-estocagem").then((r) => setTipos(Array.isArray(r) ? r : r.results), () => undefined);
    if (novo) return;
    api<Local>(`/locais-estoque/${id}`).then(setDados, (e: ApiError) => setAviso(e.message));
    api<InventarioResumo[]>(`/locais-estoque/${id}/inventarios`).then(setInventarios, () => undefined);
  }, [id, novo]);

  useEffect(() => {
    if (novo) return;
    const t = window.setTimeout(() => api<ItemEstoque[]>(`/locais-estoque/${id}/estoque?search=${encodeURIComponent(busca)}`).then(setItens, () => undefined), 250);
    return () => window.clearTimeout(t);
  }, [id, novo, busca]);

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    try {
      const corpo = JSON.stringify({ nome: dados.nome, tipo: dados.tipo, ativo: dados.ativo, padrao: dados.padrao });
      const salvo = await api<Local>(novo ? "/locais-estoque" : `/locais-estoque/${id}`, { method: novo ? "POST" : "PATCH", body: corpo });
      if (voltar) navigate(ROTA);
      else if (novo) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else {
        setDados(salvo);
        setAviso("Local salvo.");
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

  const inventariar = async () => {
    setConfirmar(false);
    try {
      const lista = await api<InventarioResumo[]>(`/locais-estoque/${id}/inventarios`, { method: "POST" });
      setInventarios(lista);
      navigate(`/estoque/inventarios/${lista[0].id}`);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível iniciar o inventário.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Estoque" title="Locais de estoque" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Nome" span={2} required maxLength={120} value={dados.nome ?? ""} disabled={!podeSalvar} error={erros.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} />
          <SelectField label="Tipo de estocagem" value={dados.tipo ?? ""} disabled={!podeSalvar} onChange={(e) => setDados((d) => ({ ...d, tipo: Number(e.target.value) }))} options={tipos.map((t) => ({ value: t.id ?? 0, label: t.nome }))} />
          <div className="flex items-end gap-6">
            <SwitchField label="Ativo?" checked={!!dados.ativo} onChange={(v) => podeSalvar && setDados((d) => ({ ...d, ativo: v }))} />
            <SwitchField label="Padrão?" checked={!!dados.padrao} onChange={(v) => podeSalvar && setDados((d) => ({ ...d, padrao: v }))} />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-muted">O local padrão recebe as entradas e saídas automáticas (entrega de pedido, recebimento de compra).</p>

        {!novo && (
          <div className="mt-8">
            <div className="grid grid-cols-2" role="tablist">
              {(["estoque", "inventarios"] as const).map((a) => (
                <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={cn("min-h-12 text-sm font-bold uppercase", aba === a ? "bg-primary text-primary-foreground" : "bg-secondary text-surface-raised")}>
                  {a === "estoque" ? "Estoque atual" : "Inventários"}
                </button>
              ))}
            </div>
            <div className="border border-t-0 border-line p-4">
              {aba === "estoque" ? (
                <>
                  <input aria-label="Localizar" placeholder="Localizar" value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-3 h-12 w-full rounded-xs border border-line bg-surface-raised px-3 md:h-[34px]" />
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-xs uppercase text-ink"><th className="py-2">Código</th><th>Item</th><th className="text-right">Qtd. disponível</th></tr></thead>
                    <tbody>
                      {itens.map((i) => (
                        <tr key={i.produto} className="border-b border-line">
                          <td className="py-2 tabular-nums text-ink-muted">{i.codigo || "—"}</td>
                          <td>{i.descricao}</td>
                          <td className="text-right tabular-nums">{Number(i.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {i.unidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {itens.length === 0 && <p className="py-4 text-center text-sm uppercase text-ink-muted">Nenhum item encontrado</p>}
                </>
              ) : (
                <>
                  {pode(ROTA, "alterar") && !dados.em_inventario && (
                    <button type="button" onClick={() => setConfirmar(true)} className="mb-3 min-h-12 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark md:min-h-10">Inventariar estoque</button>
                  )}
                  {dados.em_inventario && (
                    <Link to={`/estoque/inventarios/${dados.em_inventario}`} className="mb-3 inline-flex min-h-12 items-center rounded-xs bg-warning px-4 text-sm font-bold uppercase text-black md:min-h-10">Continuar inventário em andamento</Link>
                  )}
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-xs uppercase text-ink"><th className="py-2">Nº</th><th>Início</th><th>Fim</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {inventarios.map((i) => (
                        <tr key={i.id} className="border-b border-line">
                          <td className="py-2 tabular-nums">{i.id}</td>
                          <td>{dataHora(i.inicio)}</td>
                          <td>{dataHora(i.fim)}</td>
                          <td className={cn("font-semibold uppercase", i.status === 1 ? "text-warning-ink" : i.status === 2 ? "text-success" : "text-error")}>{i.status_nome}</td>
                          <td className="text-right"><Link to={`/estoque/inventarios/${i.id}`} className="text-primary underline">Abrir</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {inventarios.length === 0 && <p className="py-4 text-center text-sm uppercase text-ink-muted">Nenhum inventário</p>}
                </>
              )}
            </div>
          </div>
        )}
        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
      {confirmar && (
        <ConfirmDialog
          title="Inventariar estoque"
          message="Deseja realmente inventariar o local de estoque? IMPORTANTE: Não será possível movimentar o local de estoque durante o inventário."
          confirmLabel="Inventariar"
          neutro
          onCancel={() => setConfirmar(false)}
          onConfirm={inventariar}
        />
      )}
    </>
  );
}

type InventarioDetalhe = {
  id: number; local: number; local_nome: string; status: number; status_nome: string; inicio: string; fim: string | null; movimentacao: number | null;
  itens: { produto: number; codigo: string; descricao: string; unidade: string; saldo: string; contado: string | null }[];
};

/** Inventário: contagem por item (saldo atual × contado); concluir gera o acerto; cancelar libera o local. */
export function InventarioForm() {
  const { id } = useParams();
  const { pode } = useMe();
  const [inv, setInv] = useState<InventarioDetalhe | null>(null);
  const [contagens, setContagens] = useState<Record<number, string>>({});
  const [confirmar, setConfirmar] = useState<null | "concluir" | "cancelar">(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<InventarioDetalhe>(`/inventarios/${id}`).then((x) => {
      setInv(x);
      setContagens(Object.fromEntries(x.itens.filter((i) => i.contado !== null).map((i) => [i.produto, i.contado as string])));
    }, (e: ApiError) => setAviso(e.message));
  }, [id]);

  const aberto = inv?.status === 1 && pode(ROTA, "alterar");
  const agir = async (acao: "concluir" | "cancelar") => {
    setConfirmar(null);
    try {
      const x = await api<InventarioDetalhe>(`/inventarios/${id}`, { method: "POST", body: JSON.stringify({ acao, contagens }) });
      setInv(x);
      setAviso(acao === "concluir" ? "Inventário concluído. As diferenças viraram uma movimentação de acerto." : "Inventário cancelado.");
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível concluir.");
    }
  };

  if (!inv) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">{aviso || "Carregando…"}</p>;
  return (
    <>
      <PageHeader eyebrow="Estoque" title={`Inventário Nº ${inv.id}`} />
      <div className="mx-auto max-w-[992px] px-4 pb-16 pt-6 xl:px-0">
        <p className="mb-4 text-sm text-ink">
          Local: <strong>{inv.local_nome}</strong> · Status: <strong className={inv.status === 1 ? "text-warning-ink" : inv.status === 2 ? "text-success" : "text-error"}>{inv.status_nome}</strong> · Início {dataHora(inv.inicio)}
          {inv.movimentacao && <> · <Link to={`${ROTA_ESTOQUE.movimentacoes}/${inv.movimentacao}`} className="text-primary underline">ver acerto</Link></>}
        </p>
        {aviso && <p role="status" className="mb-4 rounded-xs bg-success-soft px-4 py-3 text-sm font-semibold text-success">{aviso}</p>}
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase text-ink"><th className="py-2">Código</th><th>Item</th><th className="text-right">Saldo no sistema</th><th className="w-40 text-right">Contado</th><th className="text-right">Diferença</th></tr></thead>
          <tbody>
            {inv.itens.map((i) => {
              const c = contagens[i.produto];
              const dif = c !== undefined && c !== "" ? Number(c) - Number(i.saldo) : null;
              return (
                <tr key={i.produto} className="border-b border-line">
                  <td className="py-2 tabular-nums text-ink-muted">{i.codigo || "—"}</td>
                  <td>{i.descricao} <span className="text-xs text-ink-muted">{i.unidade}</span></td>
                  <td className="text-right tabular-nums">{Number(i.saldo).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                  <td className="text-right">
                    {aberto ? (
                      <CampoNumero aria-label={`Contado de ${i.descricao}`} casas={3} value={c ?? ""} onChange={(v) => setContagens((m) => ({ ...m, [i.produto]: v }))} className="h-10 w-32 rounded-xs border border-line bg-surface-raised px-2 text-right tabular-nums" />
                    ) : (
                      <span className="tabular-nums">{c === undefined || c === "" ? "—" : Number(c).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</span>
                    )}
                  </td>
                  <td className={cn("text-right tabular-nums", dif === null ? "text-ink-muted" : dif < 0 ? "text-error" : dif > 0 ? "text-primary" : "")}>{dif === null ? "—" : dif.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inv.itens.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Nenhum produto marcado para movimentar estoque (Catálogo › Produto › aba Estoque).</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Link to={`${ROTA}/${inv.local}`} className="inline-flex min-h-12 items-center px-3 text-sm font-semibold uppercase text-primary">Voltar ao local</Link>
          {aberto && (
            <>
              <button type="button" onClick={() => setConfirmar("cancelar")} className="min-h-12 rounded-xs bg-error px-4 text-sm font-bold uppercase text-surface-raised">Cancelar inventário</button>
              <button type="button" onClick={() => setConfirmar("concluir")} className="min-h-12 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground">Concluir inventário</button>
            </>
          )}
        </div>
      </div>
      {confirmar && (
        <ConfirmDialog
          title={confirmar === "concluir" ? "Concluir inventário" : "Cancelar inventário"}
          message={confirmar === "concluir" ? "Concluir? Os itens contados ficam com a quantidade informada (a diferença vira um acerto) e o local volta a movimentar." : "Deseja realmente cancelar o inventário?"}
          confirmLabel={confirmar === "concluir" ? "Concluir" : "Cancelar inventário"}
          neutro={confirmar === "concluir"}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => agir(confirmar)}
        />
      )}
    </>
  );
}
