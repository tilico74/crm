import { useList } from "@refinedev/core";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/DataTable";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api, ApiError } from "@/lib/api";
import { formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { CampoLinha } from "@/resources/catalogo/campo";

import { ROTA_FORNECEDORES as ROTA, ROTA_TIPOS_FORNECEDOR, type FornecedorLinha, type TipoFornecedor } from "./types";

const COLUNAS: Column<FornecedorLinha>[] = [
  {
    header: "Nome",
    cell: (f) => (
      <>
        {f.nome}
        {f.bloqueado && <span className="ml-2 rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-bold text-error">BLOQUEADO</span>}
      </>
    ),
    className: "md:w-[34%]",
  },
  { header: "Tipo", cell: (f) => f.tipo_nome },
  { header: "Telefone", cell: (f) => formatarTelefone(f.telefone) || "—", className: "tabular-nums" },
  { header: "Celular", cell: (f) => formatarTelefone(f.celular) || "—", className: "tabular-nums" },
  { header: "Email", cell: (f) => <span className="normal-case">{f.email || "—"}</span> },
];

// Filtros "Localizar por" da MarketUP: Bloqueado, CPF, CNPJ, Tipo, Telefone, E-mail, Transportador.
type Filtro = "" | "bloqueado" | "cpf" | "cnpj" | "tipo" | "telefone" | "email" | "transportadora";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "bloqueado", rotulo: "Bloqueado" },
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "tipo", rotulo: "Tipo" },
  { valor: "telefone", rotulo: "Telefone" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "transportadora", rotulo: "Transportador" },
];

const controle = "h-12 rounded-xs border border-line bg-surface-raised px-3 text-base md:h-[34px] md:text-sm";

/** Estoque › Compras › Fornecedores (supplier da MarketUP): Nome · Tipo · Telefone · Celular · Email. */
export function FornecedoresList() {
  const navigate = useNavigate();
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("");
  const [criterio, setCriterio] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [tipos, setTipos] = useState<TipoFornecedor[]>([]);
  const [excluir, setExcluir] = useState<FornecedorLinha | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api<TipoFornecedor[]>("/tipos-fornecedor").then(setTipos, () => undefined);
  }, []);

  const { result, query } = useList<FornecedorLinha>({
    resource: "fornecedores",
    pagination: { currentPage: 1, pageSize },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [
      { field: "q", operator: "eq", value: termo },
      ...(filtro && criterio ? [{ field: filtro, operator: "eq" as const, value: criterio }] : []),
    ],
  });

  return (
    <>
      <PageHeader eyebrow="Compras" title="Fornecedores">
        <ListToolbar
          onSearch={(t) => {
            setTermo(t);
            setPageSize(25);
          }}
          onAdd={pode(ROTA, "adicionar") ? () => navigate(`${ROTA}/novo`) : undefined}
        />
      </PageHeader>

      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-2 px-4 xl:px-0">
        <label className="flex flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Filtrar por</span>
          <select
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value as Filtro);
              setCriterio(["bloqueado", "transportadora"].includes(e.target.value) ? "true" : "");
            }}
            className={controle}
          >
            <option value="">Selecione</option>
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </label>
        {(filtro === "bloqueado" || filtro === "transportadora") && (
          <select aria-label={FILTROS.find((f) => f.valor === filtro)?.rotulo} value={criterio} onChange={(e) => setCriterio(e.target.value)} className={controle}>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        )}
        {filtro === "tipo" && (
          <select aria-label="Tipo" value={criterio} onChange={(e) => setCriterio(e.target.value)} className={controle}>
            <option value="">Selecione</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
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
        onEdit={pode(ROTA, "acessar") ? (f) => navigate(`${ROTA}/${f.id}`) : undefined}
        onDelete={pode(ROTA, "excluir") ? setExcluir : undefined}
        onMore={() => setPageSize((n) => n + 25)}
        empty={termo || criterio ? "Nenhum fornecedor encontrado com esse critério." : "Nenhum fornecedor cadastrado."}
      />
      {excluir && (
        <ConfirmDialog
          title="Excluir fornecedor"
          message="Deseja realmente excluir o Fornecedor?"
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            setAviso("");
            try {
              await api(`/fornecedores/${alvo.id}`, { method: "DELETE" });
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

/** Ajustes › Pessoas › Tipos de fornecedor (supplier_type da MarketUP): ID · Nome; o Geral (1) é o padrão. */
export function TiposFornecedorList() {
  const { pode } = useMe();
  const tabela = useRef<TabelaEditavelRef>(null);
  const [termo, setTermo] = useState("");
  const { result, query } = useList<TipoFornecedor>({ resource: "tipos-fornecedor", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });
  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Tipos de fornecedor">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA_TIPOS_FORNECEDOR, "adicionar") ? () => tabela.current?.adicionar() : undefined} />
      </PageHeader>
      <TabelaEditavel<TipoFornecedor>
        ref={tabela}
        linhas={[...result.data].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))}
        carregando={query.isLoading}
        nova={{ nome: "" }}
        descrever={(t) => `Tipo ${t.nome || "novo"}`}
        podeEditar={() => pode(ROTA_TIPOS_FORNECEDOR, "alterar")}
        podeExcluir={(t) => pode(ROTA_TIPOS_FORNECEDOR, "excluir") && t.id !== 1}
        onSalvar={async (t) => {
          await api(t.id ? `/tipos-fornecedor/${t.id}` : "/tipos-fornecedor", { method: t.id ? "PATCH" : "POST", body: JSON.stringify({ nome: t.nome }) });
          await query.refetch();
        }}
        onExcluir={async (t) => {
          await api(`/tipos-fornecedor/${t.id}`, { method: "DELETE" });
          await query.refetch();
        }}
        colunas={[
          { cabecalho: "ID", classe: "w-16 tabular-nums", exibir: (t) => t.id ?? "—" },
          {
            cabecalho: "Nome",
            campo: "nome",
            exibir: (t) => t.nome,
            editar: (r, set, erro) => <CampoLinha rotulo="Nome" autoFocus maxLength={300} valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
          },
        ]}
      />
    </>
  );
}
