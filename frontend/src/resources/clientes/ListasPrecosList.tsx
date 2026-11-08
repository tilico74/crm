import { useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";

import { formatarDesconto, type ListaPreco } from "./types";

export const ROTA_LISTAS = "/vendas/listas-de-precos";

const COLUNAS: Column<ListaPreco>[] = [
  { header: "Descrição", cell: (l) => l.nome, className: "md:w-[50%]" },
  { header: "Desc. varejo", cell: (l) => formatarDesconto(l.desconto_varejo, l.desconto_varejo_tipo), className: "tabular-nums" },
  { header: "Desc. atacado", cell: (l) => formatarDesconto(l.desconto_atacado, l.desconto_atacado_tipo), className: "tabular-nums" },
  { header: "Itens diferenciados", cell: (l) => l.itens.length || "—", className: "tabular-nums" },
];

/** Vendas › Lista de preços / Tipos de clientes (client_type da MarketUP). */
export function ListasPrecosList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [excluir, setExcluir] = useState<ListaPreco | null>(null);
  const [aviso, setAviso] = useState("");
  const { result, query } = useList<ListaPreco>({
    resource: "listas-precos",
    pagination: { currentPage: 1, pageSize: 200 },
    filters: [{ field: "q", operator: "eq", value: termo }],
  });

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Lista de preços/Tipos de clientes">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA_LISTAS, "adicionar") ? () => navigate(`${ROTA_LISTAS}/novo`) : undefined} />
      </PageHeader>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={(l) => navigate(`${ROTA_LISTAS}/${l.id}`)}
        onDelete={pode(ROTA_LISTAS, "excluir") ? setExcluir : undefined}
        canDelete={(l) => l.id !== 1}
        empty={termo ? `Nenhuma lista encontrada para "${termo}".` : "Nenhuma lista cadastrada."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir lista de preços"
          message={`Excluir ${excluir.nome}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/listas-precos/${alvo.id}`, { method: "DELETE" });
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
