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

import type { Servico } from "./types";

export const ROTA_SERVICOS = "/catalogo/servicos";

const COLUNAS: Column<Servico>[] = [
  { header: "Código", cell: (s) => s.codigo_barras || "—", className: "tabular-nums md:w-40" },
  { header: "Nome", cell: (s) => s.nome, className: "md:w-[45%]" },
  { header: "Unidade", cell: (s) => s.unidade_sigla ?? "—" },
  { header: "Valor", cell: (s) => formatarMoeda(s.preco_venda), className: "tabular-nums md:text-right md:pr-4" },
  {
    header: "Ativo",
    cell: (s) => (s.ativo ? <span className="font-semibold text-success">Sim</span> : <span className="font-semibold text-error">Não</span>),
  },
];

/** Catálogo › Serviços, com as colunas da MarketUP. */
export function ServicosList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [excluir, setExcluir] = useState<Servico | null>(null);
  const [aviso, setAviso] = useState("");
  const { result, query } = useList<Servico>({
    resource: "servicos",
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
  });

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Serviços">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA_SERVICOS, "adicionar") ? () => navigate(`${ROTA_SERVICOS}/novo`) : undefined} />
      </PageHeader>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <DataTable
        columns={COLUNAS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={pode(ROTA_SERVICOS, "alterar") ? (s) => navigate(`${ROTA_SERVICOS}/${s.id}`) : undefined}
        onDelete={pode(ROTA_SERVICOS, "excluir") ? setExcluir : undefined}
        empty={termo ? `Nenhum serviço encontrado para "${termo}".` : "Nenhum serviço cadastrado."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir serviço"
          message={`Excluir ${excluir.nome}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/servicos/${alvo.id}`, { method: "DELETE" });
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
