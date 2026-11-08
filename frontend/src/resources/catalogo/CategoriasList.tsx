import { useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";

import type { Categoria } from "./types";

export const ROTA_CATEGORIAS = "/catalogo/categorias";

const COLUNAS: Column<Categoria>[] = [
  { header: "Nome", cell: (c) => c.nome, className: "md:w-[60%]" },
  { header: "Subcategorias", cell: (c) => c.subcategorias.length, className: "tabular-nums" },
];

/** Catálogo › Categorias, como na MarketUP (lista por nome; subcategorias dentro da ficha). */
export function CategoriasList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [excluir, setExcluir] = useState<Categoria | null>(null);
  const [aviso, setAviso] = useState("");
  const { result, query } = useList<Categoria>({
    resource: "categorias",
    pagination: { currentPage: 1, pageSize: 200 },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
  });

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Categorias">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA_CATEGORIAS, "adicionar") ? () => navigate(`${ROTA_CATEGORIAS}/novo`) : undefined} />
      </PageHeader>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={pode(ROTA_CATEGORIAS, "alterar") ? (c) => navigate(`${ROTA_CATEGORIAS}/${c.id}`) : undefined}
        onDelete={pode(ROTA_CATEGORIAS, "excluir") ? setExcluir : undefined}
        empty={termo ? `Nenhuma categoria encontrada para "${termo}".` : "Nenhuma categoria cadastrada."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir categoria"
          message={`Excluir a categoria ${excluir.nome}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/categorias/${alvo.id}`, { method: "DELETE" });
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
