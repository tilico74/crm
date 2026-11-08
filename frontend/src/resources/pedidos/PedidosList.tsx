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

import { ENTREGA, FINANCEIRO, ROTA_PEDIDOS, SITUACAO, type PedidoLinha } from "./types";

const COLUNAS: Column<PedidoLinha>[] = [
  {
    header: "Pedido",
    // Número grande com o status embaixo e a faixa colorida à esquerda, como na MarketUP.
    cell: (p) => (
      <span className={cn("flex flex-col items-center border-l-[6px] py-2 md:-ml-1", SITUACAO[p.situacao].borda)}>
        <span className={cn("text-2xl font-normal tabular-nums", SITUACAO[p.situacao].cor)}>{p.id}</span>
        <span className={cn("text-xs font-semibold uppercase", SITUACAO[p.situacao].cor)}>{SITUACAO[p.situacao].rotulo}</span>
      </span>
    ),
    className: "md:w-32",
  },
  {
    header: "Status",
    cell: (p) => (
      <span className="grid grid-cols-[auto_auto] gap-x-2 text-[10px] normal-case text-ink-muted">
        <span className="uppercase">Emitido em:</span>
        <span className="tabular-nums text-ink">{formatarData(p.emissao)}</span>
        {p.data_faturamento && (
          <>
            <span className="uppercase">Faturado em:</span>
            <span className="tabular-nums text-ink">{formatarData(p.data_faturamento)}</span>
          </>
        )}
      </span>
    ),
    className: "md:w-40",
  },
  { header: "Cliente", cell: (p) => <span className="normal-case text-base">{p.cliente_nome ?? "Sem cliente"}</span> },
  {
    header: "Entrega",
    cell: (p) => (
      <span className="flex flex-col items-center">
        <span className="text-base tabular-nums">{formatarData(p.entrega) || "—"}</span>
        {p.status !== 1 && (
          <>
            <span className="text-[9px] uppercase text-ink-muted">Status entrega:</span>
            <span className={cn("text-xs font-semibold uppercase", ENTREGA[p.entrega_status]?.cor)}>{ENTREGA[p.entrega_status]?.rotulo}</span>
          </>
        )}
      </span>
    ),
    className: "md:w-36",
  },
  {
    header: "Valor",
    cell: (p) => (
      <span className="flex flex-col items-end">
        <span className="text-base tabular-nums">{formatarMoeda(p.total)}</span>
        {p.status !== 1 && (
          <>
            <span className="text-[9px] uppercase text-ink-muted">Status pgto:</span>
            {/* Na coluna, "Pago parcialmente" fica só "Parcialmente" (embaixo de "Status pgto:"). */}
            <span className={cn("text-xs font-semibold uppercase", FINANCEIRO[p.financeiro_status]?.cor)}>
              {p.financeiro_status === 3 ? "Parcialmente" : FINANCEIRO[p.financeiro_status]?.rotulo}
            </span>
          </>
        )}
      </span>
    ),
    className: "md:w-36 md:pr-4",
  },
];

// Filtros "Localizar por" da MarketUP (Pedido).
type Filtro = "" | "status" | "cliente" | "emissao" | "faturamento" | "produto" | "valor" | "entrega" | "financeiro";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "status", rotulo: "Status" },
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "emissao", rotulo: "Data de emissão" },
  { valor: "faturamento", rotulo: "Data de faturamento" },
  { valor: "produto", rotulo: "Produtos" },
  { valor: "valor", rotulo: "Valor" },
  { valor: "entrega", rotulo: "Entrega" },
  { valor: "financeiro", rotulo: "Financeiro" },
];
// Status do filtro da MarketUP: Novo 1, Faturado/Concluído 2, Cancelado 7 (Consignado fica fora do escopo).
const STATUS_FILTRO = [
  { valor: "1", rotulo: "Novo" },
  { valor: "2,6", rotulo: "Faturado / Concluído" },
  { valor: "7", rotulo: "Cancelado" },
];
const ENTREGA_FILTRO = [1, 2, 4, 7];
const FINANCEIRO_FILTRO = [1, 2, 3, 4, 7];

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";

/** Vendas › Pedido, com as colunas (status, entrega e pagamento) e os filtros da MarketUP. */
export function PedidosList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [excluir, setExcluir] = useState<PedidoLinha | null>(null);
  const [aviso, setAviso] = useState("");

  const intervalo = ["emissao", "faturamento", "valor"].includes(filtro);
  const params: Record<string, string> = {};
  if (filtro && intervalo) {
    if (de) params[`${filtro}_de`] = de;
    if (ate) params[`${filtro}_ate`] = ate;
  } else if (filtro && de) params[filtro] = de;

  const { result, query } = useList<PedidoLinha>({
    resource: "pedidos",
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
  const opcoes =
    filtro === "status"
      ? STATUS_FILTRO
      : filtro === "entrega"
        ? ENTREGA_FILTRO.map((v) => ({ valor: String(v), rotulo: ENTREGA[v].rotulo }))
        : filtro === "financeiro"
          ? FINANCEIRO_FILTRO.map((v) => ({ valor: String(v), rotulo: FINANCEIRO[v].rotulo }))
          : null;

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Pedido">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(20);
          }}
          onAdd={pode(ROTA_PEDIDOS, "adicionar") ? () => navigate(`${ROTA_PEDIDOS}/novo`) : undefined}
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
        {opcoes && (
          <select aria-label={FILTROS.find((f) => f.valor === filtro)?.rotulo} value={de} onChange={(e) => setDe(e.target.value)} className={controle}>
            <option value="">Todos</option>
            {opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>{o.rotulo}</option>
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
              <input type={filtro === "valor" ? "number" : "date"} min={0} step="0.01" value={de} onChange={(e) => setDe(e.target.value)} className={controle} />
            </label>
            <label className="flex flex-col text-sm text-ink-muted">
              <span className="mb-1 font-label">Até:</span>
              <input type={filtro === "valor" ? "number" : "date"} min={0} step="0.01" value={ate} onChange={(e) => setAte(e.target.value)} className={controle} />
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
        onEdit={(p) => navigate(`${ROTA_PEDIDOS}/${p.id}`)}
        onDelete={pode(ROTA_PEDIDOS, "excluir") ? setExcluir : undefined}
        canDelete={(p) => p.status === 1}
        onMore={() => setPageSize((n) => n + 20)}
        empty={termo || de || ate ? "Nenhum pedido encontrado com esse critério." : "Nenhum pedido cadastrado."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir pedido"
          message={`Excluir o pedido ${excluir.id}? Isso não pode ser desfeito. Para manter o histórico, prefira Cancelar.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/pedidos/${alvo.id}`, { method: "DELETE" });
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
