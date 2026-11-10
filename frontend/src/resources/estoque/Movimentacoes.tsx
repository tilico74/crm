import { useList } from "@refinedev/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { Produto } from "@/resources/catalogo/types";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { ROTA_ESTOQUE, TIPO_MOV, type ItemMov, type Local, type Motivo, type Movimentacao } from "./types";

const ROTA = ROTA_ESTOQUE.movimentacoes;
const hoje = () => new Date().toLocaleDateString("sv-SE");
const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none disabled:bg-surface md:h-[34px] md:text-sm";
const rotulo = "mb-1 block font-label text-sm text-ink-muted";
const num = (v: string | number, casas = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });

const COLUNAS: Column<Movimentacao>[] = [
  { header: "Nº", cell: (m) => <span className="tabular-nums text-primary">{m.id}</span>, className: "md:w-16" },
  { header: "Data", cell: (m) => formatarData(m.data), className: "tabular-nums md:w-28" },
  { header: "Tipo", cell: (m) => <span className={cn("font-semibold uppercase", TIPO_MOV[m.tipo]?.cor)}>{m.tipo_nome}</span>, className: "md:w-32" },
  {
    header: "Origem",
    cell: (m) => (
      <span className="text-xs uppercase">
        {m.manual ? "Manual" : m.origem_nome}
        {m.origem_id ? ` Nº ${m.origem_id}` : ""}
        {m.motivo_nome && <span className="block text-ink-muted">Motivo: {m.motivo_nome}</span>}
      </span>
    ),
  },
  {
    header: "Local",
    cell: (m) => <span className="text-xs uppercase">{[m.local_origem_nome, m.local_destino_nome].filter(Boolean).join(" → ")}</span>,
  },
  { header: "Quantidade", cell: (m) => num(m.total_quantidade), className: "tabular-nums md:w-28 md:text-right" },
  { header: "Valor", cell: (m) => formatarMoeda(m.total_valor), className: "tabular-nums md:w-28 md:text-right md:pr-4" },
];

/** Estoque › Movimentações (new_stock_movement da MarketUP): manuais e automáticas. */
export function MovimentacoesList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [tipo, setTipo] = useState("");
  const [pageSize, setPageSize] = useState(30);
  const { result, query } = useList<Movimentacao>({
    resource: "movimentacoes-estoque",
    pagination: { currentPage: 1, pageSize },
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: { params: tipo ? { tipo } : {} },
  });
  return (
    <>
      <PageHeader eyebrow="Estoque" title="Movimentações de estoque">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA, "adicionar") ? () => navigate(`${ROTA}/novo`) : undefined} />
      </PageHeader>
      <div className="mx-auto mt-4 flex max-w-[992px] gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-12 rounded-xs border border-line bg-surface-raised px-3 md:h-[34px]">
            <option value="">Todos</option>
            {Object.entries(TIPO_MOV).map(([v, t]) => <option key={v} value={v}>{t.rotulo}</option>)}
          </select>
        </label>
      </div>
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={(m) => navigate(`${ROTA}/${m.id}`)}
        onMore={() => setPageSize((n) => n + 30)}
        empty="Nenhuma movimentação. As entregas de pedido e os recebimentos de compra aparecem aqui sozinhos."
      />
    </>
  );
}

type Linha = ItemMov & { chave: number };
let proximaChave = 1;

/** A tela não destaca campos: mostra as mensagens do servidor (inclusive as dos itens) em vez de "Confira os campos destacados". */
function mensagensDe(falha: ApiError): string {
  const textos: string[] = [];
  const juntar = (v: unknown) => {
    if (typeof v === "string") textos.push(v);
    else if (Array.isArray(v)) v.forEach(juntar);
    else if (v && typeof v === "object") Object.values(v).forEach(juntar);
  };
  juntar(falha.errors);
  return textos.length ? [...new Set(textos)].join(" ") : falha.message;
}

/**
 * Movimentação de estoque: "Qual é o tipo de movimentação?" Entrada · Saída · Transferência; data, locais, pessoa,
 * informações adicionais, dados da nota, motivo e perda e avaria (saída) e os itens. Gravada, fica só para consulta.
 */
export function MovimentacaoForm() {
  const { id } = useParams();
  const nova = id === "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [tipo, setTipo] = useState<1 | 2 | 3 | 0>(0);
  const [d, setD] = useState({ data: hoje(), local_origem: "" as number | "", local_destino: "" as number | "", pessoa: "", informacoes: "", nota_numero: "", nota_serie: "", nota_emissao: "", nota_valor_adicional: "0", motivo: "" as number | "", perda_avaria: false });
  const [itens, setItens] = useState<Linha[]>([]);
  const [salva, setSalva] = useState<Movimentacao | null>(null);
  const [locais, setLocais] = useState<Local[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [novoMotivo, setNovoMotivo] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<number | null>(null);

  useEffect(() => {
    api<Local[] | { results: Local[] }>("/locais-estoque").then((r) => {
      const lista = (Array.isArray(r) ? r : r.results).filter((l) => l.ativo);
      setLocais(lista);
      const padrao = lista.find((l) => l.padrao)?.id ?? "";
      setD((x) => ({ ...x, local_origem: x.local_origem || padrao, local_destino: x.local_destino || padrao }));
    }, () => undefined);
    api<Motivo[] | { results: Motivo[] }>("/motivos-movimentacao").then((r) => setMotivos(Array.isArray(r) ? r : r.results), () => undefined);
    api<{ results: Produto[] }>("/produtos?page_size=1000&ordering=descricao").then((r) => setProdutos(r.results.filter((p) => p.movimenta_estoque)), () => undefined);
    if (!nova) api<Movimentacao>(`/movimentacoes-estoque/${id}`).then(setSalva, (e: ApiError) => setAviso(e.message));
  }, [id, nova]);

  const encontrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? produtos.filter((p) => p.descricao.toLowerCase().includes(t) || (p.codigo_barras ?? "").includes(t)).slice(0, 12) : [];
  }, [busca, produtos]);
  const totalQ = itens.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const totalV = itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0);

  const incluir = (p: Produto) => {
    setItens((l) => [...l, { chave: proximaChave++, produto: p.id!, produto_descricao: p.descricao, codigo: p.codigo_barras, unidade: p.unidade, unidade_sigla: p.unidade_sigla, quantidade: "1", valor_unitario: String(p.preco_custo ?? "0"), lote: "", fabricacao: null, validade: null }]);
    setBusca("");
  };

  const salvar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!tipo) return setAviso("Escolha o tipo de movimentação.");
    setSalvando(true);
    setAviso("");
    setErro(false);
    const corpo = {
      tipo, data: d.data, pessoa: d.pessoa, informacoes: d.informacoes, nota_numero: d.nota_numero, nota_serie: d.nota_serie,
      nota_emissao: d.nota_emissao || null, nota_valor_adicional: d.nota_valor_adicional || "0",
      local_origem: tipo === 1 ? null : d.local_origem || null, local_destino: tipo === 2 ? null : d.local_destino || null,
      motivo: tipo === 2 ? d.motivo || null : null, perda_avaria: tipo === 2 && d.perda_avaria,
      itens: itens.map(({ chave: _c, produto_descricao: _p, codigo: _o, unidade_sigla: _u, ...i }) => i),
    };
    try {
      const m = await api<Movimentacao>("/movimentacoes-estoque", { method: "POST", body: JSON.stringify(corpo) });
      navigate(`${ROTA}/${m.id}`, { replace: true });
    } catch (falha) {
      setErro(true);
      setAviso(falha instanceof ApiError ? mensagensDe(falha) : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const criarMotivo = async () => {
    if (!novoMotivo?.trim()) return;
    try {
      const m = await api<Motivo>("/motivos-movimentacao", { method: "POST", body: JSON.stringify({ nome: novoMotivo.trim() }) });
      setMotivos((l) => [...l, m]);
      setD((x) => ({ ...x, motivo: m.id ?? "" }));
      setNovoMotivo(null);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível criar o motivo.");
    }
  };

  // Movimentação gravada: só consulta (como a MarketUP).
  if (salva) {
    return (
      <>
        <PageHeader eyebrow="Estoque" title={`Movimentação Nº ${salva.id}`} />
        <div className="mx-auto max-w-[992px] px-4 pb-16 pt-6 text-sm xl:px-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <p><span className={rotulo}>Tipo</span><strong className={cn("uppercase", TIPO_MOV[salva.tipo]?.cor)}>{salva.tipo_nome}</strong></p>
            <p><span className={rotulo}>Data</span>{formatarData(salva.data)}</p>
            <p><span className={rotulo}>Origem</span>{salva.manual ? "Manual" : `${salva.origem_nome}${salva.origem_id ? ` Nº ${salva.origem_id}` : ""}`}</p>
            <p><span className={rotulo}>Local</span>{[salva.local_origem_nome, salva.local_destino_nome].filter(Boolean).join(" → ")}</p>
            {salva.pessoa && <p><span className={rotulo}>Pessoa</span>{salva.pessoa}</p>}
            {salva.motivo_nome && <p><span className={rotulo}>Motivo</span>{salva.motivo_nome}{salva.perda_avaria ? " (perda e avaria)" : ""}</p>}
            {salva.nota_numero && <p><span className={rotulo}>Nota</span>{salva.nota_numero}/{salva.nota_serie}</p>}
            {salva.informacoes && <p className="col-span-2"><span className={rotulo}>Informações adicionais</span>{salva.informacoes}</p>}
          </div>
          <table className="mt-6 w-full">
            <thead><tr className="border-b border-line text-left text-xs uppercase text-ink"><th className="py-2">Produto</th><th className="text-right">Quantidade</th><th className="pr-2 text-right">Valor</th><th className="pl-2">Lote</th><th className="pl-2">Validade</th></tr></thead>
            <tbody>
              {salva.itens.map((i) => (
                <tr key={i.id} className="border-b border-line">
                  <td className="py-2">{i.produto_descricao}</td>
                  <td className={cn("text-right tabular-nums", Number(i.quantidade) < 0 && "text-error")}>{num(i.quantidade)} {i.unidade_sigla}</td>
                  <td className="pr-2 text-right tabular-nums">{formatarMoeda(i.valor_unitario)}</td>
                  <td className="pl-2">{i.lote || "—"}</td>
                  <td className="pl-2">{formatarData(i.validade) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right">Total: <strong className="tabular-nums">{num(salva.total_quantidade)}</strong> · <strong className="tabular-nums">{formatarMoeda(salva.total_valor)}</strong></p>
          <Link to={ROTA} className="mt-6 inline-block text-sm font-semibold uppercase text-primary">Voltar</Link>
        </div>
      </>
    );
  }

  const podeSalvar = pode(ROTA, "adicionar");
  return (
    <>
      <PageHeader eyebrow="Estoque" title="Movimentações de estoque" />
      <form onSubmit={salvar} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <h2 className="text-2xl font-normal text-ink md:text-[30px]">Movimentação de estoque</h2>
        <p className="text-sm text-ink">Qual é o tipo de movimentação?</p>
        <div className="mt-2 flex gap-6" role="radiogroup" aria-label="Tipo de movimentação">
          {([1, 2, 3] as const).map((t) => (
            <label key={t} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} className="size-5 accent-primary" />
              {TIPO_MOV[t].rotulo}
            </label>
          ))}
        </div>

        {tipo !== 0 && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className={rotulo}>Data</span><input type="date" value={d.data} onChange={(e) => setD((x) => ({ ...x, data: e.target.value }))} className={campo} /></label>
              {tipo !== 1 && (
                <label><span className={rotulo}>{tipo === 3 ? "Local de origem" : "Local de estoque"}</span>
                  <select value={d.local_origem} onChange={(e) => setD((x) => ({ ...x, local_origem: Number(e.target.value) }))} className={campo}>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
                </label>
              )}
              {tipo !== 2 && (
                <label><span className={rotulo}>{tipo === 3 ? "Local de destino" : "Local de estoque"}</span>
                  <select value={d.local_destino} onChange={(e) => setD((x) => ({ ...x, local_destino: Number(e.target.value) }))} className={campo}>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
                </label>
              )}
              <label className={tipo === 3 ? "" : "lg:col-span-2"}><span className={rotulo}>{tipo === 1 ? "Fornecedor / pessoa" : "Pessoa"}</span><input value={d.pessoa} maxLength={200} onChange={(e) => setD((x) => ({ ...x, pessoa: e.target.value }))} className={campo} /></label>
              {tipo === 2 && (
                <>
                  <label className="lg:col-span-2"><span className={rotulo}>Motivo</span>
                    <span className="flex gap-2">
                      <select value={d.motivo} onChange={(e) => setD((x) => ({ ...x, motivo: e.target.value ? Number(e.target.value) : "" }))} className={campo}>
                        <option value="">Selecione</option>
                        {motivos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                      <button type="button" onClick={() => setNovoMotivo("")} aria-label="Novo motivo" className="inline-flex size-12 shrink-0 items-center justify-center rounded-xs bg-primary text-primary-foreground md:size-[34px]"><IconPlus size={18} /></button>
                    </span>
                    {novoMotivo !== null && (
                      <span className="mt-2 flex gap-2">
                        <input autoFocus placeholder="Nome do motivo" value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} className={campo} />
                        <button type="button" onClick={criarMotivo} className="min-h-10 rounded-xs bg-primary px-3 text-xs font-bold uppercase text-primary-foreground">Salvar</button>
                        <button type="button" onClick={() => setNovoMotivo(null)} className="min-h-10 px-2 text-xs font-semibold uppercase text-ink-muted">Cancelar</button>
                      </span>
                    )}
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={d.perda_avaria} onChange={(e) => setD((x) => ({ ...x, perda_avaria: e.target.checked }))} className="size-5 accent-primary" />Perda e avaria</label>
                </>
              )}
              <label className="sm:col-span-2 lg:col-span-4"><span className={rotulo}>Informações adicionais</span><input value={d.informacoes} onChange={(e) => setD((x) => ({ ...x, informacoes: e.target.value }))} className={campo} /></label>
            </div>
            {tipo !== 3 && (
              <fieldset className="mt-6 border-t border-line pt-4">
                <legend className="pr-2 text-xs font-bold uppercase text-ink">Dados fiscais</legend>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
                  <label><span className={rotulo}>Nº NF-e</span><input value={d.nota_numero} maxLength={20} onChange={(e) => setD((x) => ({ ...x, nota_numero: e.target.value }))} className={campo} /></label>
                  <label><span className={rotulo}>Série</span><input value={d.nota_serie} maxLength={5} onChange={(e) => setD((x) => ({ ...x, nota_serie: e.target.value }))} className={campo} /></label>
                  <label><span className={rotulo}>Data de emissão</span><input type="date" value={d.nota_emissao} onChange={(e) => setD((x) => ({ ...x, nota_emissao: e.target.value }))} className={campo} /></label>
                  <label><span className={rotulo}>Valor adicional</span><CampoNumero value={d.nota_valor_adicional} prefixo="R$ " onChange={(v) => setD((x) => ({ ...x, nota_valor_adicional: v }))} className={cn(campo, "text-right")} /></label>
                </div>
              </fieldset>
            )}

            <h3 className="mt-8 border-b border-line pb-1 text-sm font-semibold uppercase text-ink">Itens</h3>
            <div className="relative mt-3">
              <input aria-label="Buscar produto" placeholder="Digite o nome ou código do produto (só os que movimentam estoque)" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} />
              {encontrados.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised shadow-lg">
                  {encontrados.map((p) => (
                    <li key={p.id}><button type="button" onClick={() => incluir(p)} className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-primary-light">{p.codigo_barras ? `[${p.codigo_barras}] ` : ""}{p.descricao}</button></li>
                  ))}
                </ul>
              )}
              {produtos.length === 0 && <p className="mt-1 text-xs text-ink-muted">Nenhum produto movimenta estoque. Ligue "Movimentar estoque" na aba Estoque do produto.</p>}
            </div>
            {itens.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line text-left text-xs uppercase text-ink"><th className="py-2">Produto</th><th className="w-28 text-right">Quantidade</th><th className="w-32 pr-2 text-right">Valor</th><th className="w-28 pl-2">Lote</th><th className="w-36 pl-2">Fabricação</th><th className="w-36 pl-2">Validade</th><th className="w-10" /></tr></thead>
                  <tbody>
                    {itens.map((i) => {
                      const mudar = (p: Partial<Linha>) => setItens((l) => l.map((x) => (x.chave === i.chave ? { ...x, ...p } : x)));
                      return (
                        <tr key={i.chave} className="border-b border-line">
                          <td className="py-2">{i.produto_descricao} <span className="text-xs text-ink-muted">{i.unidade_sigla}</span></td>
                          <td><CampoNumero aria-label="Quantidade" casas={3} value={i.quantidade} onChange={(v) => mudar({ quantidade: v })} className="h-10 w-full rounded-xs border border-line px-2 text-right tabular-nums" /></td>
                          <td><CampoNumero aria-label="Valor" prefixo="R$ " value={i.valor_unitario} onChange={(v) => mudar({ valor_unitario: v })} className="h-10 w-full rounded-xs border border-line px-2 text-right tabular-nums" /></td>
                          <td><input aria-label="Lote" value={i.lote} maxLength={40} onChange={(e) => mudar({ lote: e.target.value })} className="h-10 w-full rounded-xs border border-line px-2" /></td>
                          <td><input aria-label="Fabricação" type="date" value={i.fabricacao ?? ""} onChange={(e) => mudar({ fabricacao: e.target.value || null })} className="h-10 w-full rounded-xs border border-line px-1" /></td>
                          <td><input aria-label="Validade" type="date" value={i.validade ?? ""} onChange={(e) => mudar({ validade: e.target.value || null })} className="h-10 w-full rounded-xs border border-line px-1" /></td>
                          <td><button type="button" onClick={() => setRemovendo(i.chave)} aria-label="Remover item" className="inline-flex size-10 items-center justify-center text-error"><IconTrash size={18} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-right text-sm">Total: <strong className="tabular-nums">{num(totalQ)}</strong> · <strong className="tabular-nums">{formatarMoeda(totalV)}</strong></p>
              </div>
            )}
          </>
        )}
        <BarraAcoes voltar={ROTA} aviso={aviso} erro={erro} podeSalvar={podeSalvar && tipo !== 0} salvando={salvando} onSalvarEVoltar={salvar} />
      </form>
      {removendo !== null && (
        <ConfirmDialog title="Remover item" message="Deseja realmente excluir o registro?" confirmLabel="Excluir"
          onConfirm={() => { setItens((l) => l.filter((x) => x.chave !== removendo)); setRemovendo(null); }} onCancel={() => setRemovendo(null)} />
      )}
    </>
  );
}
