import { useList } from "@refinedev/core";
import { useRef, useState } from "react";

import { useMe } from "@/app/useMe";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api } from "@/lib/api";
import { CampoLinha } from "@/resources/catalogo/campo";

import type { Motivo, TipoEstocagem } from "./types";

/** Estoque › Tipos de estocagem (storage_type da MarketUP): Nome; o "Padrão" é do sistema. */
export function TiposEstocagemList() {
  const rota = "/estoque/tipos-de-estocagem";
  const { pode } = useMe();
  const tabela = useRef<TabelaEditavelRef>(null);
  const [termo, setTermo] = useState("");
  const { result, query } = useList<TipoEstocagem>({ resource: "tipos-estocagem", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });
  return (
    <>
      <PageHeader eyebrow="Estoque" title="Tipos de estocagem">
        <ListToolbar onSearch={setTermo} onAdd={pode(rota, "adicionar") ? () => tabela.current?.adicionar() : undefined} />
      </PageHeader>
      <TabelaEditavel<TipoEstocagem>
        ref={tabela}
        linhas={[...result.data].sort((a, b) => a.nome.localeCompare(b.nome))}
        carregando={query.isLoading}
        nova={{ nome: "", sistema: false }}
        descrever={(t) => `Tipo ${t.nome || "novo"}`}
        podeEditar={(t) => pode(rota, "alterar") && !t.sistema}
        podeExcluir={(t) => pode(rota, "excluir") && !t.sistema}
        onSalvar={async (t) => {
          await api(t.id ? `/tipos-estocagem/${t.id}` : "/tipos-estocagem", { method: t.id ? "PATCH" : "POST", body: JSON.stringify({ nome: t.nome }) });
          await query.refetch();
        }}
        onExcluir={async (t) => {
          await api(`/tipos-estocagem/${t.id}`, { method: "DELETE" });
          await query.refetch();
        }}
        colunas={[
          {
            cabecalho: "Nome",
            campo: "nome",
            exibir: (t) => t.nome,
            editar: (r, set, erro) => <CampoLinha rotulo="Nome" autoFocus maxLength={80} valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
          },
        ]}
      />
    </>
  );
}

/** Estoque › Motivo movimentação (stock_movement_reason da MarketUP): ID · Nome. */
export function MotivosList() {
  const rota = "/estoque/motivos";
  const { pode } = useMe();
  const tabela = useRef<TabelaEditavelRef>(null);
  const [termo, setTermo] = useState("");
  const { result, query } = useList<Motivo>({ resource: "motivos-movimentacao", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });
  return (
    <>
      <PageHeader eyebrow="Estoque" title="Motivo">
        <ListToolbar onSearch={setTermo} onAdd={pode(rota, "adicionar") ? () => tabela.current?.adicionar() : undefined} />
      </PageHeader>
      <TabelaEditavel<Motivo>
        ref={tabela}
        linhas={result.data}
        carregando={query.isLoading}
        nova={{ nome: "" }}
        descrever={(m) => `Motivo ${m.nome || "novo"}`}
        podeEditar={() => pode(rota, "alterar")}
        podeExcluir={() => pode(rota, "excluir")}
        onSalvar={async (m) => {
          await api(m.id ? `/motivos-movimentacao/${m.id}` : "/motivos-movimentacao", { method: m.id ? "PATCH" : "POST", body: JSON.stringify({ nome: m.nome }) });
          await query.refetch();
        }}
        onExcluir={async (m) => {
          await api(`/motivos-movimentacao/${m.id}`, { method: "DELETE" });
          await query.refetch();
        }}
        colunas={[
          { cabecalho: "ID", classe: "w-16 tabular-nums", exibir: (m) => m.id ?? "—" },
          {
            cabecalho: "Nome",
            campo: "nome",
            exibir: (m) => m.nome,
            editar: (r, set, erro) => <CampoLinha rotulo="Nome" autoFocus maxLength={120} valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
          },
        ]}
      />
    </>
  );
}
