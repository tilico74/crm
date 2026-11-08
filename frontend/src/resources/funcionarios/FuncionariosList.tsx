import { useDelete, useList } from "@refinedev/core";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { formatarTelefone } from "@/lib/mascaras";

import type { Funcionario } from "./types";

const ROTA = "/ajustes/funcionarios";

const COLUNAS_FUNCIONARIOS: Column<Funcionario>[] = [
  { header: "Nome", cell: (f) => f.nome, className: "md:w-[34%]" },
  { header: "Código", cell: (f) => f.codigo },
  { header: "Telefone", cell: (f) => formatarTelefone(f.telefone), className: "tabular-nums" },
  { header: "Celular", cell: (f) => formatarTelefone(f.celular), className: "tabular-nums" },
  { header: "Email", cell: (f) => <span className="normal-case">{f.email}</span>, className: "break-all" },
];

const COLUNAS_USUARIOS: Column<Funcionario>[] = [
  { header: "Login", cell: (f) => <span className="normal-case">{f.login}</span> },
  { header: "Nome", cell: (f) => f.nome, className: "md:w-[36%]" },
  { header: "Grupo", cell: (f) => f.grupo_nome ?? "—" },
  {
    header: "Situação",
    cell: (f) =>
      f.bloqueado ? <span className="font-semibold text-error">Bloqueado</span> : <span className="font-semibold text-success">Ativo</span>,
  },
];

/**
 * Ajustes › Funcionários (e Ajustes › Usuários, que é a mesma lista só com quem tem login),
 * com as colunas da MarketUP.
 */
export function FuncionariosList({ usuarios = false }: { usuarios?: boolean }) {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [excluir, setExcluir] = useState<Funcionario | null>(null);
  const { mutate: remover } = useDelete();

  const { result, query } = useList<Funcionario>({
    resource: "funcionarios",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
    meta: usuarios ? { params: { com_login: 1 } } : undefined,
  });

  return (
    <>
      <PageHeader eyebrow="Empresa" title={usuarios ? "Usuários" : "Funcionários"}>
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(25);
          }}
          onAdd={pode(ROTA, "adicionar") ? () => navigate(`${ROTA}/novo`) : undefined}
        />
      </PageHeader>

      <DataTable
        columns={usuarios ? COLUNAS_USUARIOS : COLUNAS_FUNCIONARIOS}
        rows={result.data}
        total={result.total}
        loading={query.isLoading}
        onEdit={pode(ROTA, "alterar") ? (f) => navigate(`${ROTA}/${f.id}`) : undefined}
        onDelete={!usuarios && pode(ROTA, "excluir") ? setExcluir : undefined}
        onMore={() => setPageSize((n) => n + 25)}
        empty={termo ? `Nenhum funcionário encontrado para "${termo}".` : "Nenhum funcionário cadastrado."}
      />

      {excluir && (
        <ConfirmDialog
          title="Excluir funcionário"
          message={`Excluir ${excluir.nome}? O login dele também deixa de funcionar. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            remover({ resource: "funcionarios", id: excluir.id });
            setExcluir(null);
          }}
        />
      )}
    </>
  );
}
