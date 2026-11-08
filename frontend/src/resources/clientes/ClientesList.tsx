import { useList } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import type { ClienteLinha, ListaPreco } from "./types";

export const ROTA_CLIENTES = "/vendas/clientes";

const COLUNAS: Column<ClienteLinha>[] = [
  {
    header: "Nome",
    cell: (c) => (
      <>
        {c.nome}
        {c.bloqueado && <span className="ml-2 rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-bold text-error">BLOQUEADO</span>}
      </>
    ),
    className: "md:w-[34%]",
  },
  { header: "Tipo", cell: (c) => c.lista_preco_nome },
  { header: "Telefone", cell: (c) => formatarTelefone(c.telefone) || "—", className: "tabular-nums" },
  { header: "Celular", cell: (c) => formatarTelefone(c.celular) || "—", className: "tabular-nums" },
  { header: "Email", cell: (c) => <span className="normal-case">{c.email || "—"}</span> },
];

// Filtros "Localizar por" da MarketUP: Bloqueado, CPF, CNPJ, Tipo, Telefone, E-mail.
type Filtro = "" | "bloqueado" | "cpf" | "cnpj" | "lista_preco" | "telefone" | "email";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "bloqueado", rotulo: "Bloqueado" },
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "lista_preco", rotulo: "Tipo" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "email", rotulo: "E-mail" },
];

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";

/** Vendas › Clientes, com as colunas e os filtros da MarketUP. */
export function ClientesList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  const [criterio, setCriterio] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [listas, setListas] = useState<ListaPreco[]>([]);
  const [excluir, setExcluir] = useState<ClienteLinha | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<{ results: ListaPreco[] }>("/listas-precos?page_size=200").then((r) => setListas(r.results), () => undefined);
  }, []);

  const { result, query } = useList<ClienteLinha>({
    resource: "clientes",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [
      { field: "q", operator: "eq", value: termo },
      ...(filtro && criterio ? [{ field: filtro, operator: "eq" as const, value: criterio }] : []),
    ],
  });

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Clientes">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(25);
          }}
          onAdd={pode(ROTA_CLIENTES, "adicionar") ? () => navigate(`${ROTA_CLIENTES}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Filtrar por</span>
          <select
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value as Filtro);
              setCriterio(e.target.value === "bloqueado" ? "true" : "");
            }}
            className={controle}
          >
            <option value="">Selecione</option>
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </label>
        {filtro === "bloqueado" && (
          <select aria-label="Bloqueado" value={criterio} onChange={(e) => setCriterio(e.target.value)} className={controle}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        )}
        {filtro === "lista_preco" && (
          <select aria-label="Tipo (lista de preços)" value={criterio} onChange={(e) => setCriterio(e.target.value)} className={controle}>
            <option value="">Selecione</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        )}
        {["cpf", "cnpj", "telefone", "email"].includes(filtro) && (
          <input
            aria-label={FILTROS.find((f) => f.valor === filtro)?.rotulo}
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            inputMode={filtro === "email" ? "email" : "numeric"}
            className={cn(controle, "w-56")}
          />
        )}
        {filtro && (
          <button type="button" onClick={() => { setFiltro(""); setCriterio(""); }} className="min-h-12 px-2 text-xs font-semibold uppercase text-primary md:min-h-[34px]">
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
        onEdit={pode(ROTA_CLIENTES, "alterar") || pode(ROTA_CLIENTES, "acessar") ? (c) => navigate(`${ROTA_CLIENTES}/${c.id}`) : undefined}
        onDelete={pode(ROTA_CLIENTES, "excluir") ? setExcluir : undefined}
        onMore={() => setPageSize((n) => n + 25)}
        empty={termo || criterio ? "Nenhum cliente encontrado com esse critério." : "Nenhum cliente cadastrado."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir cliente"
          message={`Excluir ${excluir.nome}? Endereços, contatos e documentos dele também serão excluídos. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/clientes/${alvo.id}`, { method: "DELETE" });
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
