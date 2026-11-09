import { useList } from "@refinedev/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { ROTA_APROVACAO, ROTA_COMISSOES, type Comissao, type Vendedor } from "./types";

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";
const num = (v: string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Vendas › Comissões (Lançamento de comissões da MarketUP): Data · Fechamento · Comissionado · Venda ·
 * % Comissão · Comissão. Marcando lançamentos em aberto, "Fechar selecionados" abre a Aprovação (só o gerente).
 */
export function ComissoesList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [situacao, setSituacao] = useState<"" | "false" | "true">("false");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [marcados, setMarcados] = useState<Comissao[]>([]);
  const [excluir, setExcluir] = useState<Comissao | null>(null);
  const [aviso, setAviso] = useState("");
  const podeAprovar = pode(ROTA_APROVACAO, "adicionar");

  useEffect(() => {
    api<Vendedor[]>("/comissoes/vendedores").then(setVendedores, () => undefined);
  }, []);

  const params: Record<string, string> = {};
  if (vendedor) params.vendedor = vendedor;
  if (situacao) params.fechada = situacao;
  if (de) params.emissao_de = de;
  if (ate) params.emissao_ate = ate;

  const { result, query } = useList<Comissao>({
    resource: "comissoes",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "emissao", order: "desc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: { params },
  });
  const linhas = result.data;
  const marcado = (c: Comissao) => marcados.some((m) => m.id === c.id);
  const alternar = (c: Comissao) => setMarcados((atual) => (marcado(c) ? atual.filter((m) => m.id !== c.id) : [...atual, c]));
  const totalMarcado = marcados.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Comissões">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(20);
          }}
          onAdd={pode(ROTA_COMISSOES, "adicionar") ? () => navigate(`${ROTA_COMISSOES}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Comissionado</span>
          <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={controle}>
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Situação</span>
          <select value={situacao} onChange={(e) => { setSituacao(e.target.value as typeof situacao); setMarcados([]); }} className={controle}>
            <option value="false">Em aberto</option>
            <option value="true">Fechadas</option>
            <option value="">Todas</option>
          </select>
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Data de:</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={controle} />
        </label>
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Até:</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} />
        </label>
        {pode(ROTA_APROVACAO) && (
          <Link to={ROTA_APROVACAO} className="ml-auto inline-flex min-h-12 items-center px-2 text-sm font-semibold uppercase text-primary hover:text-primary-dark md:min-h-[34px]">
            Aprovações (fechamentos)
          </Link>
        )}
      </div>

      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

      <div className="mx-auto max-w-[992px] overflow-x-auto px-4 pb-28 xl:px-0">
        <table className="mt-2 w-full text-sm text-ink">
          <thead>
            <tr className="h-[60px] border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
              <th className="w-10"><span className="sr-only">Selecionar</span></th>
              <th className="px-1">Data</th>
              <th className="px-1">Fechamento</th>
              <th className="px-1">Comissionado</th>
              <th className="px-1">Pedido</th>
              <th className="px-1 text-right">Venda</th>
              <th className="px-1 text-right">% Comissão</th>
              <th className="px-1 text-right">Comissão</th>
              <th className="w-24"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => {
              const aberta = !c.fechamento;
              return (
                <tr key={c.id} className={cn("border-b border-line", marcado(c) && "bg-primary-light")}>
                  <td className="text-center">
                    {aberta && podeAprovar && (
                      <input type="checkbox" checked={marcado(c)} onChange={() => alternar(c)} aria-label={`Selecionar comissão ${c.id}`} className="size-5 accent-primary" />
                    )}
                  </td>
                  <td className="px-1 py-3 tabular-nums">{formatarData(c.emissao)}</td>
                  <td className="px-1 tabular-nums">{c.data_fechamento ? formatarData(c.data_fechamento) : <span className="text-ink-muted">—</span>}</td>
                  <td className="px-1 uppercase">
                    {c.vendedor_nome}
                    {c.estorno_de && <span className="ml-1 rounded-xs bg-error-soft px-1 text-[10px] font-bold text-error">estorno</span>}
                  </td>
                  <td className="px-1 tabular-nums">
                    {c.pedido ? (
                      <Link to={`/vendas/pedidos/${c.pedido}`} className="text-primary underline">{c.pedido}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-1 text-right tabular-nums">{formatarMoeda(c.valor_venda)}</td>
                  <td className="px-1 text-right tabular-nums">{num(c.percentual)}</td>
                  <td className={cn("px-1 text-right font-semibold tabular-nums", Number(c.valor) < 0 && "text-error")}>{formatarMoeda(c.valor)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" onClick={() => navigate(`${ROTA_COMISSOES}/${c.id}`)} aria-label="Abrir" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9">
                      <IconPencil size={18} aria-hidden />
                    </button>
                    {aberta && pode(ROTA_COMISSOES, "excluir") && (
                      <button type="button" onClick={() => setExcluir(c)} aria-label="Excluir" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft md:size-9">
                        <IconTrash size={18} aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!query.isLoading && linhas.length === 0 && <p className="py-8 text-center text-sm font-semibold uppercase text-ink-muted">Nenhuma comissão encontrada.</p>}
        <div className="mt-3 flex items-center justify-between text-xs uppercase text-ink-muted">
          <span>Exibindo {linhas.length} de {result.total ?? 0} registros.</span>
          <button type="button" onClick={() => setPageSize((n) => n + 20)} disabled={linhas.length >= (result.total ?? 0)} className="min-h-12 rounded-xs bg-secondary px-4 font-bold text-surface-raised disabled:bg-secondary-light disabled:text-ink-muted md:min-h-9">
            Ver mais registros
          </button>
        </div>
      </div>

      {marcados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
          <div className="mx-auto flex max-w-[992px] flex-wrap items-center gap-3 px-4 py-3 xl:px-0">
            <span className="mr-auto text-sm">
              {marcados.length} selecionado(s) · <strong className="tabular-nums">{formatarMoeda(totalMarcado)}</strong>
            </span>
            <button type="button" onClick={() => setMarcados([])} className="min-h-12 px-3 text-sm font-semibold uppercase text-ink-muted hover:text-ink">
              Limpar
            </button>
            <button
              type="button"
              onClick={() => navigate(`${ROTA_APROVACAO}/novo`, { state: { comissoes: marcados } })}
              className="min-h-12 rounded-xs bg-primary px-5 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark"
            >
              Fechar selecionados
            </button>
          </div>
        </div>
      )}

      {excluir && (
        <ConfirmDialog
          title="Excluir comissão"
          message={`Deseja realmente excluir o lançamento de ${excluir.vendedor_nome} (${formatarMoeda(excluir.valor)})?`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/comissoes/${alvo.id}`, { method: "DELETE" });
              setMarcados((m) => m.filter((x) => x.id !== alvo.id));
              await query.refetch();
            } catch (erro) {
              setAviso(erro instanceof ApiError ? erro.message : "Não foi possível excluir.");
            }
          }}
        />
      )}
    </>
  );
}
