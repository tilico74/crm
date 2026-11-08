import { useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarMoeda } from "@/lib/mascaras";

import type { Produto } from "./types";

export const ROTA_PRODUTOS = "/catalogo/produtos";

const COLUNAS: Column<Produto>[] = [
  {
    header: "Descrição",
    cell: (p) => (
      <>
        {p.descricao}
        {!p.ncm && (
          <span title="Sem NCM: não sai na nota fiscal" className="ml-2 rounded-xs bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">
            SEM NCM
          </span>
        )}
      </>
    ),
    className: "md:w-[42%]",
  },
  { header: "Valor de venda", cell: (p) => formatarMoeda(p.preco_venda), className: "tabular-nums md:text-right md:pr-4" },
  { header: "Categoria", cell: (p) => p.categoria_nome ?? "—" },
  { header: "Subcategoria", cell: (p) => p.subcategoria_nome ?? "—" },
  {
    header: "Ativo",
    cell: (p) => (p.ativo ? <span className="font-semibold text-success">Sim</span> : <span className="font-semibold text-error">Não</span>),
  },
];

/** Catálogo › Produtos, com as colunas da MarketUP. O selo "Sem NCM" ajuda a corrigir o cadastro fiscal. */
export function ProdutosList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [semNcm, setSemNcm] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [excluir, setExcluir] = useState<Produto | null>(null);
  const [aviso, setAviso] = useState("");

  const { result, query } = useList<Produto>({
    resource: "produtos",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "descricao", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: semNcm ? { params: { sem_ncm: 1 } } : undefined,
  });

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Produtos">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(50);
          }}
          onAdd={pode(ROTA_PRODUTOS, "adicionar") ? () => navigate(`${ROTA_PRODUTOS}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto flex max-w-[992px] items-center gap-2 px-4 pt-4 xl:px-0">
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={semNcm} onChange={(e) => setSemNcm(e.target.checked)} className="size-5 accent-primary" />
          Mostrar só os produtos sem NCM
        </label>
      </div>
      {aviso && <p role="alert" className="mx-auto mt-2 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={pode(ROTA_PRODUTOS, "alterar") ? (p) => navigate(`${ROTA_PRODUTOS}/${p.id}`) : undefined}
        onDelete={pode(ROTA_PRODUTOS, "excluir") ? setExcluir : undefined}
        onMore={() => setPageSize((n) => n + 50)}
        empty={termo ? `Nenhum produto encontrado para "${termo}".` : semNcm ? "Todos os produtos têm NCM." : "Nenhum produto cadastrado."}
      />

      {excluir && (
        <ConfirmDialog
          title="Excluir produto"
          message={`Excluir ${excluir.descricao}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/produtos/${alvo.id}`, { method: "DELETE" });
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
