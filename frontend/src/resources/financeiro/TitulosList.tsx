import { useList } from "@refinedev/core";
import { IconCircleCheckFilled, IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { LADO, ORIGEM, statusTitulo, type Lado, type Titulo } from "./titulos";
import type { ContaGerencial, TipoPagamento } from "./types";

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";
const tresMesesAtras = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toLocaleDateString("sv-SE");
};

/**
 * Financeiro › Contas a receber / Contas a pagar (receivable / payable da MarketUP):
 * Vencimento + status · Conta (descrição, sacado/beneficiário) · Conta gerencial + origem · Valor · Saldo,
 * totais no topo, filtros da MarketUP e seleção para receber/pagar várias de uma vez.
 */
export function TitulosList({ lado, quitadasInicial = "0", titulo }: { lado: Lado; quitadasInicial?: "0" | "1"; titulo?: string }) {
  const t = LADO[lado];
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [vencidas, setVencidas] = useState("");
  const [quitadas, setQuitadas] = useState<string>(quitadasInicial);
  const [gerencial, setGerencial] = useState("");
  const [forma, setForma] = useState("");
  // Como os atalhos do menu da MarketUP: vencimento a partir de 3 meses atrás (dá para limpar o filtro).
  const [de, setDe] = useState(tresMesesAtras());
  const [ate, setAte] = useState("");
  const [pageSize, setPageSize] = useState(30);
  const [gerenciais, setGerenciais] = useState<ContaGerencial[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [marcados, setMarcados] = useState<Titulo[]>([]);
  const [excluir, setExcluir] = useState<Titulo | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<{ results: ContaGerencial[] }>("/contas-gerenciais?page_size=200&ordering=nome").then(
      (r) => setGerenciais(r.results.filter((g) => g.ativo && (lado === "pagar" || g.tipo === "E"))),
      () => undefined,
    );
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results), () => undefined);
  }, [lado]);

  const params: Record<string, string> = {};
  if (vencidas) params.vencidas = vencidas;
  if (quitadas) params.quitadas = quitadas;
  if (gerencial) params.conta_gerencial = gerencial;
  if (forma) params.tipo_pagamento = forma;
  if (de) params.vencimento_de = de;
  if (ate) params.vencimento_ate = ate;

  const { result, query } = useList<Titulo>({
    resource: t.api.slice(1),
    pagination: { currentPage: 1, pageSize },
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: { params },
  });
  const linhas = result.data;
  const extra = (query.data ?? {}) as unknown as { total_valor?: string; total_saldo?: string };
  const marcado = (x: Titulo) => marcados.some((m) => m.id === x.id);
  const alternar = (x: Titulo) => setMarcados((a) => (marcado(x) ? a.filter((m) => m.id !== x.id) : [...a, x]));

  const baixarSelecionadas = () => {
    // Como a MarketUP: uma só abre a ficha; várias abrem o recebimento/pagamento de múltiplas contas.
    if (marcados.length === 1) return navigate(`${t.rota}/${marcados[0].id}`);
    navigate(`${t.rota}/baixar`, { state: { titulos: marcados } });
  };

  return (
    <>
      <PageHeader eyebrow="Financeiro" title={titulo ?? t.titulo}>
        <ListToolbar onSearch={(x) => { setTermo(x); setPageSize(30); }} onAdd={pode(t.rota, "adicionar") ? () => navigate(`${t.rota}/novo`) : undefined} />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Status</span>
          <select value={quitadas} onChange={(e) => setQuitadas(e.target.value)} className={controle}>
            <option value="0">Em aberto</option>
            <option value="1">{lado === "receber" ? "Recebidas" : "Pagas"}</option>
            <option value="">Todas</option>
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Vencimento</span>
          <select value={vencidas} onChange={(e) => setVencidas(e.target.value)} className={controle}>
            <option value="">Todas</option>
            <option value="1">Vencidas</option>
            <option value="0">A vencer</option>
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Conta gerencial</span>
          <select value={gerencial} onChange={(e) => setGerencial(e.target.value)} className={cn(controle, "max-w-52")}>
            <option value="">Todas</option>
            {gerenciais.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Tipo de pagamento</span>
          <select value={forma} onChange={(e) => setForma(e.target.value)} className={cn(controle, "max-w-44")}>
            <option value="">Todos</option>
            {tipos.map((x) => <option key={x.id} value={x.id}>{x.descricao}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Vencimento de</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={controle} />
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} />
        </label>
      </div>

      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

      <div className="mx-auto max-w-[992px] overflow-x-auto px-4 pb-28 xl:px-0">
        <table className="mt-2 w-full text-sm text-ink">
          <thead>
            <tr className="h-[60px] border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
              <th className="w-10"><span className="sr-only">Selecionar</span></th>
              <th className="px-1">Vencimento</th>
              <th className="px-1">Conta</th>
              <th className="px-1">Conta gerencial</th>
              <th className="px-1 text-right">Valor</th>
              <th className="px-1 text-right">Saldo</th>
              <th className="w-20"><span className="sr-only">Ações</span></th>
            </tr>
            {/* Totais da lista, como a barra da MarketUP. */}
            <tr className="border-b border-line text-base">
              <td colSpan={4} />
              <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatarMoeda(extra?.total_valor ?? 0)}</td>
              <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatarMoeda(extra?.total_saldo ?? 0)}</td>
              <td />
            </tr>
          </thead>
          <tbody>
            {linhas.map((x) => {
              const st = statusTitulo(x.situacao, lado);
              const aberta = Number(x.saldo) > 0;
              return (
                <tr key={x.id} onClick={() => navigate(`${t.rota}/${x.id}`)} className={cn("cursor-pointer border-b border-line hover:bg-surface", marcado(x) && "bg-primary-light")}>
                  <td className={cn("border-l-[6px] text-center", st.faixa.split(" ")[0].replace("bg-", "border-"))} onClick={(e) => e.stopPropagation()}>
                    {aberta ? (
                      <input type="checkbox" checked={marcado(x)} onChange={() => alternar(x)} aria-label={`Selecionar ${x.descricao}`} className="size-5 accent-primary" />
                    ) : (
                      <IconCircleCheckFilled size={20} className="mx-auto text-success" aria-label={t.quitada} />
                    )}
                  </td>
                  <td className="px-1 py-3">
                    <span className="block text-base tabular-nums">{formatarData(x.vencimento)}</span>
                    <span className={cn("text-[10px] font-semibold uppercase", st.cor)}>{st.rotulo}</span>
                  </td>
                  <td className="px-1">
                    <span className="block uppercase">{x.descricao}{x.parcelas > 1 ? ` (${x.parcela}/${x.parcelas})` : ""}{x.tipo_pagamento_nome ? ` (${x.tipo_pagamento_nome})` : ""}</span>
                    <span className="text-[10px] uppercase text-ink-muted">{t.pessoa}: {x.pessoa_nome || "não informado"}</span>
                  </td>
                  <td className="px-1">
                    <span className="block uppercase">{x.conta_gerencial_nome ?? "—"}</span>
                    <span className="text-[10px] uppercase text-ink-muted">Origem: {ORIGEM[x.origem] ?? x.origem_nome}</span>
                  </td>
                  <td className="px-1 text-right text-base tabular-nums">{formatarMoeda(x.valor)}</td>
                  <td className={cn("px-1 text-right text-base font-semibold tabular-nums", aberta ? "text-ink" : "text-success")}>{formatarMoeda(x.saldo)}</td>
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => navigate(`${t.rota}/${x.id}`)} aria-label="Abrir" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9">
                      <IconPencil size={18} aria-hidden />
                    </button>
                    {x.manual && pode(t.rota, "excluir") && (
                      <button type="button" onClick={() => setExcluir(x)} aria-label="Excluir" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft md:size-9">
                        <IconTrash size={18} aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!query.isLoading && linhas.length === 0 && <p className="py-8 text-center text-sm font-semibold uppercase text-ink-muted">Nenhuma conta encontrada.</p>}
        <div className="mt-3 flex items-center justify-between text-xs uppercase text-ink-muted">
          <span>Exibindo {linhas.length} de {result.total ?? 0} registros.</span>
          <button type="button" onClick={() => setPageSize((n) => n + 30)} disabled={linhas.length >= (result.total ?? 0)} className="min-h-12 rounded-xs bg-secondary px-4 font-bold text-surface-raised disabled:bg-secondary-light disabled:text-ink-muted md:min-h-9">
            Ver mais registros
          </button>
        </div>
      </div>

      {marcados.length > 0 && pode(t.rota, "alterar") && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
          <div className="mx-auto flex max-w-[992px] flex-wrap items-center gap-3 px-4 py-3 xl:px-0">
            <span className="mr-auto text-sm">
              {marcados.length} selecionada(s) · saldo <strong className="tabular-nums">{formatarMoeda(marcados.reduce((s, x) => s + Number(x.saldo), 0))}</strong>
            </span>
            <button type="button" onClick={() => setMarcados([])} className="min-h-12 px-3 text-sm font-semibold uppercase text-ink-muted hover:text-ink">Limpar</button>
            <button type="button" onClick={baixarSelecionadas} className="min-h-12 rounded-xs bg-primary px-5 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark">
              {lado === "receber" ? "Receber selecionadas" : "Pagar selecionadas"}
            </button>
          </div>
        </div>
      )}

      {excluir && (
        <ConfirmDialog
          title="Excluir conta"
          message={`Deseja realmente excluir "${excluir.descricao}" (${formatarMoeda(excluir.valor)})? Os ${t.verbo}s dela também saem do caixa.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`${t.api}/${alvo.id}`, { method: "DELETE" });
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
