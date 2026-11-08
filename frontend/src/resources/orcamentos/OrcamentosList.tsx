import { useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { STATUS, type OrcamentoLinha } from "./types";

export const ROTA_ORCAMENTOS = "/vendas/orcamentos";

const COLUNAS: Column<OrcamentoLinha>[] = [
  {
    header: "Orçamento",
    // Número grande com o status embaixo e a faixa colorida à esquerda, como na MarketUP.
    cell: (o) => (
      <span className={cn("flex flex-col items-center border-l-[6px] py-2 md:-ml-1", STATUS[o.status].borda)}>
        <span className="text-2xl font-normal tabular-nums text-primary">{o.id}</span>
        <span className={cn("text-xs font-semibold", STATUS[o.status].cor)}>{STATUS[o.status].rotulo}</span>
      </span>
    ),
    className: "md:w-32",
  },
  {
    header: "Status",
    cell: (o) => (
      <span className="grid grid-cols-[auto_auto] gap-x-2 text-[10px] normal-case text-ink-muted">
        <span className="uppercase">Válido até:</span>
        <span className="tabular-nums text-ink">{formatarData(o.validade) || "—"}</span>
        <span className="uppercase">Entrega em:</span>
        <span className="tabular-nums text-ink">{formatarData(o.entrega) || "—"}</span>
        {o.data_pedido && (
          <>
            <span className="uppercase">Pedido em:</span>
            <span className="tabular-nums text-ink">{formatarData(o.data_pedido)}</span>
          </>
        )}
      </span>
    ),
    className: "md:w-40",
  },
  { header: "Cliente", cell: (o) => <span className="normal-case text-base">{o.cliente_nome ?? "Sem cliente"}</span> },
  { header: "Data", cell: (o) => formatarData(o.emissao), className: "tabular-nums text-base md:w-28" },
  { header: "Valor", cell: (o) => formatarMoeda(o.total), className: "tabular-nums text-base md:w-32 md:text-right md:pr-4" },
];

// Filtros "Localizar por" da MarketUP.
type Filtro = "" | "status" | "cliente" | "emissao" | "pedido" | "validade" | "produto" | "valor";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "status", rotulo: "Status" },
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "emissao", rotulo: "Data de Emissão" },
  { valor: "pedido", rotulo: "Data de Pedido" },
  { valor: "validade", rotulo: "Data de Validade" },
  { valor: "produto", rotulo: "Produtos" },
  { valor: "valor", rotulo: "Valor" },
];

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";

/** Vendas › Orçamento, com as colunas e os filtros da MarketUP. */
export function OrcamentosList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [excluir, setExcluir] = useState<OrcamentoLinha | null>(null);
  const [aviso, setAviso] = useState("");

  const intervalo = ["emissao", "pedido", "validade", "valor"].includes(filtro);
  const params: Record<string, string> = {};
  if (filtro && intervalo) {
    if (de) params[`${filtro}_de`] = de;
    if (ate) params[`${filtro}_ate`] = ate;
  } else if (filtro && de) params[filtro] = de;

  const { result, query } = useList<OrcamentoLinha>({
    resource: "orcamentos",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "id", order: "desc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: { params },
  });

  const trocarFiltro = (f: Filtro) => {
    setFiltro(f);
    setDe("");
    setAte("");
  };
  const tipoCampo = filtro === "valor" ? "number" : "date";

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Orçamento">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(20);
          }}
          onAdd={pode(ROTA_ORCAMENTOS, "adicionar") ? () => navigate(`${ROTA_ORCAMENTOS}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Filtrar por</span>
          <select value={filtro} onChange={(e) => trocarFiltro(e.target.value as Filtro)} className={controle}>
            <option value="">Selecione</option>
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </label>
        {filtro === "status" && (
          <select aria-label="Status" value={de} onChange={(e) => setDe(e.target.value)} className={controle}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([v, s]) => (
              <option key={v} value={v}>{s.rotulo}</option>
            ))}
          </select>
        )}
        {(filtro === "cliente" || filtro === "produto") && (
          <input aria-label={filtro === "cliente" ? "Cliente" : "Produto"} value={de} onChange={(e) => setDe(e.target.value)} className={cn(controle, "w-64")} />
        )}
        {intervalo && (
          <>
            <label className="flex flex-col text-sm text-ink-muted">
              <span className="mb-1 font-label">De:</span>
              <input type={tipoCampo} min={0} step="0.01" value={de} onChange={(e) => setDe(e.target.value)} className={controle} />
            </label>
            <label className="flex flex-col text-sm text-ink-muted">
              <span className="mb-1 font-label">Até:</span>
              <input type={tipoCampo} min={0} step="0.01" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} />
            </label>
          </>
        )}
        {filtro && (
          <button type="button" onClick={() => trocarFiltro("")} className="min-h-12 px-2 text-xs font-semibold uppercase text-primary md:min-h-[34px]">
            Limpar filtro
          </button>
        )}
      </div>

      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={(o) => navigate(`${ROTA_ORCAMENTOS}/${o.id}`)}
        onDelete={pode(ROTA_ORCAMENTOS, "excluir") ? setExcluir : undefined}
        canDelete={(o) => o.status === 1}
        onMore={() => setPageSize((n) => n + 20)}
        empty={termo || de || ate ? "Nenhum orçamento encontrado com esse critério." : "Nenhum orçamento cadastrado."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir orçamento"
          message={`Excluir o orçamento ${excluir.id}? Isso não pode ser desfeito. Para manter o histórico, prefira Cancelar.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/orcamentos/${alvo.id}`, { method: "DELETE" });
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
