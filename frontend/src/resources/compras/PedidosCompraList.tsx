import { useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarCnpj, formatarCpf, formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { SITUACAO } from "@/resources/pedidos/types";

import { COR_STATUS, ROTA_PEDIDOS_COMPRA as ROTA, type PedidoCompraLinha } from "./pedidos";

const documento = (d: string) => (d.length === 14 ? formatarCnpj(d) : d.length === 11 ? formatarCpf(d) : d);

const COLUNAS: Column<PedidoCompraLinha>[] = [
  {
    header: "Pedido",
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
  {
    header: "Fornecedor",
    cell: (p) => (
      <span className="flex flex-col items-center text-center normal-case">
        <span className="text-base">{p.fornecedor_nome}</span>
        {(p.fornecedor_documento || p.fornecedor_ie) && (
          <span className="text-[11px] tabular-nums text-ink-muted">
            {p.fornecedor_documento && `${p.fornecedor_documento.length === 11 ? "CPF" : "CNPJ"}: ${documento(p.fornecedor_documento)}`}
            {p.fornecedor_documento && p.fornecedor_ie && "  |  "}
            {p.fornecedor_ie && `IE: ${p.fornecedor_ie}`}
          </span>
        )}
      </span>
    ),
  },
  {
    header: "Recebimento",
    cell: (p) => (
      <span className="flex flex-col items-center">
        <span className="text-base tabular-nums">{formatarData(p.previsao) || "—"}</span>
        <span className="text-[9px] uppercase text-ink-muted">Status entrega:</span>
        <span className={cn("text-xs font-semibold uppercase", COR_STATUS[p.recebimento_lista])}>{p.recebimento_lista}</span>
      </span>
    ),
    className: "md:w-36",
  },
  {
    header: "Valor",
    cell: (p) => (
      <span className="flex flex-col items-end">
        <span className="text-base tabular-nums">{formatarMoeda(p.total)}</span>
        <span className="text-[9px] uppercase text-ink-muted">Status pgto:</span>
        <span className={cn("text-xs font-semibold uppercase", COR_STATUS[p.pagamento_lista])}>{p.pagamento_lista}</span>
      </span>
    ),
    className: "md:w-36 md:pr-4",
  },
];

type Filtro = "" | "status" | "fornecedor" | "emissao" | "faturamento" | "produto" | "valor";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "status", rotulo: "Status" },
  { valor: "fornecedor", rotulo: "Fornecedor" },
  { valor: "emissao", rotulo: "Data de emissão" },
  { valor: "faturamento", rotulo: "Data de faturamento" },
  { valor: "produto", rotulo: "Produtos" },
  { valor: "valor", rotulo: "Valor" },
];
const STATUS_FILTRO = [
  { valor: "1", rotulo: "Novo" },
  { valor: "2,6", rotulo: "Faturado / Concluído" },
  { valor: "7", rotulo: "Cancelado" },
];
const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";

/**
 * Estoque › Compras › Pedidos (purchase_order da MarketUP): Pedido (nº + status) · Status (emitido / faturado em) ·
 * Fornecedor (nome, CNPJ | IE) · Recebimento (data + status entrega) · Valor (+ status pgto).
 * `aReceber` = Compras em aberto: só os faturados com item ainda não recebido.
 */
export function PedidosCompraList({ aReceber = false }: { aReceber?: boolean }) {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [excluir, setExcluir] = useState<PedidoCompraLinha | null>(null);
  const [aviso, setAviso] = useState("");

  const intervalo = ["emissao", "faturamento", "valor"].includes(filtro);
  const params: Record<string, string> = aReceber ? { a_receber: "1" } : {};
  if (filtro && intervalo) {
    if (de) params[`${filtro}_de`] = de;
    if (ate) params[`${filtro}_ate`] = ate;
  } else if (filtro && de) params[filtro] = de;

  const { result, query } = useList<PedidoCompraLinha>({
    resource: "pedidos-compra",
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

  return (
    <>
      <PageHeader eyebrow="Compras" title={aReceber ? "Compras em aberto" : "Pedido"}>
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(20);
          }}
          onAdd={pode(ROTA, "adicionar") ? () => navigate(`${ROTA}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Filtrar por</span>
          <select value={filtro} onChange={(e) => trocarFiltro(e.target.value as Filtro)} className={controle}>
            <option value="">Selecione</option>
            {FILTROS.filter((f) => !aReceber || f.valor !== "status").map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </label>
        {filtro === "status" && (
          <select aria-label="Status" value={de} onChange={(e) => setDe(e.target.value)} className={controle}>
            <option value="">Todos</option>
            {STATUS_FILTRO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        )}
        {(filtro === "fornecedor" || filtro === "produto") && (
          <input aria-label={filtro === "fornecedor" ? "Fornecedor" : "Produto"} value={de} onChange={(e) => setDe(e.target.value)} className={cn(controle, "w-64")} />
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
        onEdit={(p) => navigate(`${ROTA}/${p.id}`)}
        onDelete={pode(ROTA, "excluir") ? setExcluir : undefined}
        canDelete={(p) => p.status === 1}
        onMore={() => setPageSize((n) => n + 20)}
        empty={termo || de || ate ? "Nenhum pedido encontrado com esse critério." : aReceber ? "Nenhuma compra em aberto." : "Nenhum pedido cadastrado."}
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
              await api(`/pedidos-compra/${alvo.id}`, { method: "DELETE" });
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
