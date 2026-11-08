import { useList } from "@refinedev/core";
import { useRef, useState } from "react";

import { useMe } from "@/app/useMe";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api } from "@/lib/api";

import { CampoLinha } from "./campo";
import type { Unidade } from "./types";

const ROTA = "/catalogo/unidades";

/** Catálogo › Unidades de medida, como na MarketUP: ID, Sigla, Nome; edição na linha; as do sistema ficam travadas. */
export function UnidadesList() {
  const { pode } = useMe();
  const tabela = useRef<TabelaEditavelRef>(null);
  const [termo, setTermo] = useState("");
  const { result, query } = useList<Unidade>({ resource: "unidades", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });

  const salvar = async (u: Unidade) => {
    const corpo = JSON.stringify({ sigla: u.sigla, nome: u.nome });
    await api(u.id ? `/unidades/${u.id}` : "/unidades", { method: u.id ? "PATCH" : "POST", body: corpo });
    await query.refetch();
  };

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Unidades de medida">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA, "adicionar") ? () => tabela.current?.adicionar() : undefined} />
      </PageHeader>
      <TabelaEditavel<Unidade>
        ref={tabela}
        linhas={[...result.data].sort((a, b) => a.nome.localeCompare(b.nome))}
        carregando={query.isLoading}
        nova={{ sigla: "", nome: "", sistema: false }}
        descrever={(u) => `Unidade ${u.sigla || u.nome || "nova"}`}
        podeEditar={(u) => pode(ROTA, "alterar") && !u.sistema}
        podeExcluir={(u) => pode(ROTA, "excluir") && !u.sistema}
        onSalvar={salvar}
        onExcluir={async (u) => {
          await api(`/unidades/${u.id}`, { method: "DELETE" });
          await query.refetch();
        }}
        colunas={[
          { cabecalho: "ID", classe: "w-16 tabular-nums", exibir: (u) => u.id ?? "—" },
          {
            cabecalho: "Sigla",
            campo: "sigla",
            classe: "w-32",
            exibir: (u) => u.sigla,
            editar: (r, set, erro) => <CampoLinha rotulo="Sigla" autoFocus maxLength={10} valor={r.sigla} onChange={(v) => set({ sigla: v.toUpperCase() })} erro={erro} />,
          },
          {
            cabecalho: "Nome",
            campo: "nome",
            exibir: (u) => (
              <>
                {u.nome}
                {u.sistema && <span className="ml-2 text-xs normal-case text-ink-muted">(padrão do sistema)</span>}
              </>
            ),
            editar: (r, set, erro) => <CampoLinha rotulo="Nome" valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
          },
        ]}
        vazio="Nenhuma unidade encontrada."
      />
    </>
  );
}
