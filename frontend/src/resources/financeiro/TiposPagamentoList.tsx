import { useDelete, useList, type HttpError } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";

import type { TipoPagamento } from "./types";

export const ROTA_TIPOS_PAGAMENTO = "/ajustes/tipos-de-pagamento";

const COLUNAS: Column<TipoPagamento>[] = [
  { header: "Descrição", cell: (t) => t.descricao, className: "md:w-[60%]" },
  { header: "Condições", cell: (t) => t.condicoes.length, className: "tabular-nums" },
  {
    header: "Ativo",
    cell: (t) => (t.ativo ? <span className="font-semibold text-success">Sim</span> : <span className="font-semibold text-error">Não</span>),
  },
];

/** Ajustes › Financeiro › Tipos de pagamento (a coluna "PDV" da MarketUP fica fora: PDV fora do escopo). */
export function TiposPagamentoList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [excluir, setExcluir] = useState<TipoPagamento | null>(null);
  const [aviso, setAviso] = useState("");
  const { mutate: remover } = useDelete();

  const { result, query } = useList<TipoPagamento>({
    resource: "tipos-pagamento",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "descricao", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
  });

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Tipo de pagamento">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(25);
          }}
          onAdd={pode(ROTA_TIPOS_PAGAMENTO, "adicionar") ? () => navigate(`${ROTA_TIPOS_PAGAMENTO}/novo`) : undefined}
        />
      </PageHeader>

      {aviso && (
        <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">
          {aviso}
        </p>
      )}

      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={pode(ROTA_TIPOS_PAGAMENTO, "alterar") ? (t) => navigate(`${ROTA_TIPOS_PAGAMENTO}/${t.id}`) : undefined}
        onDelete={pode(ROTA_TIPOS_PAGAMENTO, "excluir") ? setExcluir : undefined}
        onMore={() => setPageSize((n) => n + 25)}
        empty={termo ? `Nenhum tipo de pagamento encontrado para "${termo}".` : "Nenhum tipo de pagamento cadastrado."}
      />

      {excluir && (
        <ConfirmDialog
          title="Excluir tipo de pagamento"
          message={`Excluir ${excluir.descricao} e as ${excluir.condicoes.length} condições dele? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            setAviso("");
            remover(
              { resource: "tipos-pagamento", id: excluir.id, successNotification: false, errorNotification: false },
              { onError: (erro: HttpError) => setAviso(erro.message) },
            );
            setExcluir(null);
          }}
        />
      )}
    </>
  );
}
