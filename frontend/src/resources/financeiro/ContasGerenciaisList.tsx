import { useDelete, useList, type HttpError } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";

import type { ContaGerencial } from "./types";

export const ROTA_CONTAS_GERENCIAIS = "/ajustes/contas-gerenciais";

const COLUNAS: Column<ContaGerencial>[] = [
  { header: "Código", cell: (c) => c.codigo_referencia || "—" },
  { header: "Nome", cell: (c) => c.nome, className: "md:w-[34%]" },
  { header: "Tipo", cell: (c) => c.tipo_nome },
  { header: "DRE", cell: (c) => c.classificacao_dre_nome || "—" },
  {
    header: "Ativo",
    cell: (c) => (c.ativo ? <span className="font-semibold text-success">Sim</span> : <span className="font-semibold text-error">Não</span>),
  },
];

/** Ajustes › Financeiro › Conta gerencial, com as colunas da MarketUP. */
export function ContasGerenciaisList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [excluir, setExcluir] = useState<ContaGerencial | null>(null);
  const [aviso, setAviso] = useState("");
  const { mutate: remover } = useDelete();

  const { result, query } = useList<ContaGerencial>({
    resource: "contas-gerenciais",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "codigo_referencia", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
  });

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Conta gerencial">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(100);
          }}
          onAdd={pode(ROTA_CONTAS_GERENCIAIS, "adicionar") ? () => navigate(`${ROTA_CONTAS_GERENCIAIS}/novo`) : undefined}
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
        onEdit={pode(ROTA_CONTAS_GERENCIAIS, "alterar") ? (c) => navigate(`${ROTA_CONTAS_GERENCIAIS}/${c.id}`) : undefined}
        onDelete={pode(ROTA_CONTAS_GERENCIAIS, "excluir") ? setExcluir : undefined}
        // Contas do sistema (padrão da MarketUP) não têm lixeira.
        canDelete={(c) => !c.sistema}
        onMore={() => setPageSize((n) => n + 100)}
        empty={termo ? `Nenhuma conta encontrada para "${termo}".` : "Nenhuma conta gerencial cadastrada."}
      />

      {excluir && (
        <ConfirmDialog
          title="Excluir conta gerencial"
          message={`Excluir a conta ${excluir.nome}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            setAviso("");
            remover(
              { resource: "contas-gerenciais", id: excluir.id, errorNotification: false },
              { onError: (erro: HttpError) => setAviso(erro.message) },
            );
            setExcluir(null);
          }}
        />
      )}
    </>
  );
}
