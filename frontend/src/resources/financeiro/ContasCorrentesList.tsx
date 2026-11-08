import { useCreate, useDelete, useList, useUpdate, type HttpError } from "@refinedev/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useState, type KeyboardEvent } from "react";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

import { comDigito, simNao } from "./regras";
import type { Banco, ContaCorrente } from "./types";

const ROTA = "/ajustes/contas-correntes";
type Rascunho = Omit<ContaCorrente, "id" | "banco_nome"> & { id?: number };
type Erros = Record<string, string[] | string>;

const NOVA: Rascunho = {
  nome: "", interna: false, banco: null, agencia: "", agencia_digito: "", conta: "", conta_digito: "", principal: false, ativo: true,
};

const campo =
  "h-12 w-full min-w-0 rounded-xs border border-line bg-surface-raised px-2 text-base text-ink focus:border-brand-cyan focus:outline-none aria-[invalid=true]:border-error md:h-[34px] md:text-sm";

/**
 * Ajustes › Financeiro › Conta corrente, como na MarketUP: a edição é na própria
 * linha (lápis → campos + ✓ confirmar / ✗ cancelar) e "Adicionar novo" abre uma linha no topo.
 */
export function ContasCorrentesList() {
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");
  const [excluir, setExcluir] = useState<ContaCorrente | null>(null);

  const { result, query } = useList<ContaCorrente>({
    resource: "contas-correntes",
    pagination: { currentPage: 1, pageSize: 200 },
    sorters: [{ field: "nome", order: "asc" }],
    filters: [{ field: "q", operator: "eq", value: termo }],
  });
  const { result: bancos } = useList<Banco>({ resource: "bancos", pagination: { mode: "off" } });
  const { mutate: criar, mutation: criacao } = useCreate<ContaCorrente, HttpError>();
  const { mutate: atualizar, mutation: atualizacao } = useUpdate<ContaCorrente, HttpError>();
  const { mutate: remover } = useDelete();
  const salvando = criacao.isPending || atualizacao.isPending;

  const abrir = (conta: Rascunho) => {
    setErros({});
    setAviso("");
    setEditando(conta);
  };
  const cancelar = () => {
    setEditando(null);
    setErros({});
  };

  const confirmar = () => {
    if (!editando) return;
    const { id, ...valores } = editando;
    const opcoes = {
      onSuccess: () => {
        setEditando(null);
        setAviso(id ? "Conta corrente salva." : "Conta corrente criada.");
      },
      onError: (erro: HttpError) => {
        setErros((erro.errors as Erros) ?? {});
        setAviso(erro.message);
      },
    };
    if (id) atualizar({ resource: "contas-correntes", id, values: valores, successNotification: false, errorNotification: false }, opcoes);
    else criar({ resource: "contas-correntes", values: valores, successNotification: false, errorNotification: false }, opcoes);
  };

  // Enter confirma e Esc cancela, como em uma planilha.
  const teclas = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    } else if (e.key === "Escape") {
      cancelar();
    }
  };

  const linhaNova = editando && !editando.id;

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Contas correntes">
        {/* Com uma linha em edição, "Adicionar novo" leva o foco de volta a ela em vez de abrir outra. */}
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA, "adicionar") ? () => (editando ? document.querySelector<HTMLInputElement>("[aria-label=Nome]")?.focus() : abrir({ ...NOVA })) : undefined} />
      </PageHeader>

      <div className="mx-auto max-w-[992px] px-4 pb-10 xl:px-0">
        {aviso && (
          <p role="status" className={cn("mt-4 rounded-xs px-4 py-3 text-sm font-semibold", Object.keys(erros).length ? "bg-error-soft text-error" : "bg-success-soft text-success")}>
            {aviso}
          </p>
        )}

        <table className="w-full border-collapse text-sm text-ink">
          <thead className="hidden md:table-header-group">
            <tr className="h-[72px] border-b border-line text-left text-sm font-bold uppercase text-primary-dark">
              <th scope="col" className="w-[22%] px-1">Nome</th>
              <th scope="col" className="w-16 px-1 text-center">Interna</th>
              <th scope="col" className="px-1">Banco</th>
              <th scope="col" className="w-32 px-1">Agência</th>
              <th scope="col" className="w-40 px-1">Conta</th>
              <th scope="col" className="w-20 px-1 text-center">Principal</th>
              <th scope="col" className="w-14 px-1 text-center">Ativo</th>
              <th scope="col" className="w-[104px]"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {linhaNova && (
              <LinhaEdicao conta={editando} bancos={bancos.data} erros={erros} salvando={salvando} onChange={setEditando} onConfirmar={confirmar} onCancelar={cancelar} onKeyDown={teclas} />
            )}
            {result.data.map((c) =>
              editando?.id === c.id ? (
                <LinhaEdicao key={c.id} conta={editando} bancos={bancos.data} erros={erros} salvando={salvando} onChange={setEditando} onConfirmar={confirmar} onCancelar={cancelar} onKeyDown={teclas} />
              ) : (
                <tr key={c.id} className="flex flex-col gap-1 border-b border-line py-3 uppercase even:bg-surface md:table-row md:h-16 md:py-0">
                  <td className="px-1 font-semibold md:font-normal">{c.nome}</td>
                  <td className="px-1 md:text-center"><Rotulo>Interna: </Rotulo>{simNao(c.interna)}</td>
                  <td className="truncate px-1 md:max-w-[220px]" title={c.banco_nome ?? ""}><Rotulo>Banco: </Rotulo>{c.banco_nome ?? "—"}</td>
                  <td className="px-1 tabular-nums"><Rotulo>Agência: </Rotulo>{comDigito(c.agencia, c.agencia_digito)}</td>
                  <td className="px-1 tabular-nums"><Rotulo>Conta: </Rotulo>{comDigito(c.conta, c.conta_digito)}</td>
                  <td className="px-1 md:text-center"><Rotulo>Principal: </Rotulo>{simNao(c.principal)}</td>
                  <td className="px-1 md:text-center"><Rotulo>Ativo: </Rotulo>{simNao(c.ativo)}</td>
                  <td className="flex justify-end gap-1 md:table-cell md:whitespace-nowrap md:text-right">
                    {pode(ROTA, "alterar") && (
                      <button type="button" onClick={() => abrir({ ...c })} disabled={!!editando} aria-label={`Editar ${c.nome}`} className="inline-flex size-12 items-center justify-center hover:text-primary disabled:opacity-40">
                        <IconPencil size={22} aria-hidden />
                      </button>
                    )}
                    {pode(ROTA, "excluir") && (
                      <button type="button" onClick={() => setExcluir(c)} disabled={!!editando} aria-label={`Excluir ${c.nome}`} className="inline-flex size-12 items-center justify-center text-error hover:opacity-80 disabled:opacity-40">
                        <IconTrash size={22} aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {query.isLoading && <p className="py-6 text-ink-muted">Carregando…</p>}
        {!query.isLoading && !result.data.length && !linhaNova && (
          <p className="py-6 text-ink-muted">{termo ? `Nenhuma conta encontrada para "${termo}".` : "Nenhuma conta corrente cadastrada."}</p>
        )}
        {!!result.data.length && (
          <p className="py-6 text-center text-xs font-semibold uppercase text-ink-muted">Exibindo {result.data.length} registros</p>
        )}
      </div>

      {excluir && (
        <ConfirmDialog
          title="Excluir conta corrente"
          message={`Excluir a conta ${excluir.nome}? Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={() => {
            setAviso("");
            remover(
              { resource: "contas-correntes", id: excluir.id, successNotification: false, errorNotification: false },
              { onError: (erro: HttpError) => setAviso(erro.message) },
            );
            setExcluir(null);
          }}
        />
      )}
    </>
  );
}

function Rotulo({ children }: { children: string }) {
  return <span className="text-xs font-semibold normal-case text-ink-muted md:hidden">{children}</span>;
}

type LinhaProps = {
  conta: Rascunho;
  bancos: Banco[];
  erros: Erros;
  salvando: boolean;
  onChange: (c: Rascunho) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
};

/** Linha em edição: os campos ficam no lugar das colunas (no celular, um embaixo do outro). */
function LinhaEdicao({ conta, bancos, erros, salvando, onChange, onConfirmar, onCancelar, onKeyDown }: LinhaProps) {
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => onChange({ ...conta, [k]: v });
  const erro = (k: string) => {
    const e = erros[k];
    return e ? (Array.isArray(e) ? e.join(" ") : e) : "";
  };
  const digitos = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
  const interruptor = (rotulo: string, k: "interna" | "principal" | "ativo") => (
    <label className="flex min-h-12 items-center justify-center gap-2 md:min-h-0">
      <input type="checkbox" checked={conta[k]} onChange={(e) => set(k, e.target.checked)} className="size-5 accent-primary" />
      <span className="text-xs md:sr-only">{rotulo}</span>
    </label>
  );

  return (
    <tr onKeyDown={onKeyDown} className="flex flex-col gap-2 border-b-2 border-primary bg-primary-light/40 p-3 md:table-row md:p-0">
      <td className="px-1 md:py-3">
        <input autoFocus aria-label="Nome" aria-invalid={!!erro("nome")} value={conta.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome" className={campo} />
        {erro("nome") && <p className="mt-1 text-xs font-semibold text-error">{erro("nome")}</p>}
      </td>
      <td className="px-1">{interruptor("Interna", "interna")}</td>
      <td className="px-1">
        <select aria-label="Banco" value={conta.banco ?? ""} onChange={(e) => set("banco", e.target.value ? Number(e.target.value) : null)} disabled={conta.interna} className={campo}>
          <option value="">{conta.interna ? "Conta interna" : "Selecione o banco"}</option>
          {bancos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.codigo} - {b.nome}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1">
        <div className="flex items-center gap-1">
          <input aria-label="Agência" inputMode="numeric" value={conta.agencia} onChange={(e) => set("agencia", digitos(e.target.value, 6))} disabled={conta.interna} className={cn(campo, "tabular-nums")} />
          <span aria-hidden>-</span>
          <input aria-label="Dígito da agência" value={conta.agencia_digito} onChange={(e) => set("agencia_digito", e.target.value.toUpperCase().slice(0, 2))} disabled={conta.interna} className={cn(campo, "w-12 shrink-0 tabular-nums")} />
        </div>
      </td>
      <td className="px-1">
        <div className="flex items-center gap-1">
          <input aria-label="Conta" inputMode="numeric" value={conta.conta} onChange={(e) => set("conta", digitos(e.target.value, 15))} disabled={conta.interna} className={cn(campo, "tabular-nums")} />
          <span aria-hidden>-</span>
          <input aria-label="Dígito da conta" value={conta.conta_digito} onChange={(e) => set("conta_digito", e.target.value.toUpperCase().slice(0, 2))} disabled={conta.interna} className={cn(campo, "w-12 shrink-0 tabular-nums")} />
        </div>
      </td>
      <td className="px-1">{interruptor("Principal", "principal")}</td>
      <td className="px-1">{interruptor("Ativo", "ativo")}</td>
      <td className="flex justify-end gap-1 px-1 md:table-cell md:whitespace-nowrap md:text-right">
        <button type="button" onClick={onConfirmar} disabled={salvando} aria-label="Confirmar" title="Confirmar (Enter)" className="inline-flex size-12 items-center justify-center text-success hover:bg-success-soft disabled:opacity-50">
          <IconCheck size={24} aria-hidden />
        </button>
        <button type="button" onClick={onCancelar} aria-label="Cancelar" title="Cancelar (Esc)" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft">
          <IconX size={24} aria-hidden />
        </button>
      </td>
    </tr>
  );
}
