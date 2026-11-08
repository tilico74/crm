import { useCreate, useCustom, useCustomMutation, useDelete, useList, useUpdate, type HttpError } from "@refinedev/core";
import { IconChevronDown, IconChevronRight, IconCirclePlus, IconPencil, IconTrash, IconUsers } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import type { Grupo } from "@/resources/funcionarios/types";

const ROTA = "/ajustes/permissoes";
const ACOES = ["acessar", "adicionar", "alterar", "excluir"] as const;
type Acao = (typeof ACOES)[number];
type Linha = { funcionalidade: string } & Record<Acao, boolean>;
type Funcionalidade = { id: number; codigo: string; modulo: string; nome: string };

/**
 * Ajustes › Permissões, como na MarketUP: escolhe o grupo e marca, para cada
 * funcionalidade, Acessar / Adicionar / Alterar / Excluir.
 */
export function Permissoes() {
  const { pode } = useMe();
  const podeAlterar = pode(ROTA, "alterar");
  const [grupoId, setGrupoId] = useState<number | null>(null);
  const [matriz, setMatriz] = useState<Record<string, Linha>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState("");
  const [nomeEditando, setNomeEditando] = useState<string | null>(null);
  const [novoGrupo, setNovoGrupo] = useState<string | null>(null);
  const [excluir, setExcluir] = useState(false);

  const { result: grupos } = useList<Grupo>({ resource: "grupos", pagination: { currentPage: 1, pageSize: 100 } });
  const { result: funcs } = useList<Funcionalidade>({ resource: "funcionalidades", pagination: { mode: "off" } });
  const grupo = grupos.data.find((g) => g.id === grupoId);

  useEffect(() => {
    if (grupoId === null && grupos.data.length) setGrupoId(grupos.data[0].id);
  }, [grupos.data, grupoId]);

  const { query: matrizQuery } = useCustom<Linha[]>({
    url: `/grupos/${grupoId}/permissoes`,
    method: "get",
    queryOptions: { enabled: grupoId !== null },
  });

  const vazia = useMemo(
    () => Object.fromEntries(funcs.data.map((f) => [f.codigo, { funcionalidade: f.codigo, acessar: false, adicionar: false, alterar: false, excluir: false }])),
    [funcs.data],
  );

  useEffect(() => {
    const linhas = matrizQuery.data?.data;
    if (!linhas) return;
    setMatriz({ ...vazia, ...Object.fromEntries(linhas.map((l) => [l.funcionalidade, l])) });
    setAviso("");
  }, [matrizQuery.data, vazia]);

  const modulos = useMemo(() => {
    const porModulo = new Map<string, Funcionalidade[]>();
    for (const f of funcs.data) porModulo.set(f.modulo, [...(porModulo.get(f.modulo) ?? []), f]);
    return [...porModulo.entries()];
  }, [funcs.data]);

  const marcar = (codigos: string[], acao: Acao, valor: boolean) =>
    setMatriz((m) => {
      const nova = { ...m };
      for (const c of codigos) {
        const linha = { ...nova[c], [acao]: valor };
        // Sem "acessar" as outras ações não fazem sentido; com qualquer outra, "acessar" vem junto.
        if (acao === "acessar" && !valor) ACOES.forEach((a) => (linha[a] = false));
        if (acao !== "acessar" && valor) linha.acessar = true;
        nova[c] = linha;
      }
      return nova;
    });

  const { mutate: salvarMatriz, mutation: gravacao } = useCustomMutation<Linha[], HttpError>();
  const salvando = gravacao.isPending;
  const { mutate: criarGrupo } = useCreate<Grupo>();
  const { mutate: atualizarGrupo } = useUpdate<Grupo>();
  const { mutate: removerGrupo } = useDelete<Grupo>();

  const salvar = () =>
    salvarMatriz(
      { url: `/grupos/${grupoId}/permissoes`, method: "put", values: Object.values(matriz).filter((l) => ACOES.some((a) => l[a])) },
      {
        onSuccess: () => setAviso("Permissões salvas."),
        onError: (e) => setAviso(e.message),
      },
    );

  const bloco = "flex min-h-12 items-center gap-2 px-3 text-xs font-semibold uppercase hover:bg-black/5";

  return (
    <>
      <PageHeader eyebrow="Empresa" title="Permissões" />

      <div className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        {/* Grupos: escolha + ações, e o bloco "Novo grupo" (MarketUP). */}
        <div className="flex flex-col gap-[2px] sm:flex-row">
          <div className="flex-1 bg-warning-soft">
            <label className="flex items-center gap-2 bg-warning px-3">
              <span className="sr-only">Grupo</span>
              <select
                value={grupoId ?? ""}
                onChange={(e) => setGrupoId(Number(e.target.value))}
                className="h-12 w-full bg-transparent text-sm font-bold uppercase text-[#3d2e00] focus:outline-none"
              >
                {grupos.data.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                    {g.ativo ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </label>
            {podeAlterar && grupo && (
              <div className="flex flex-wrap text-warning-ink">
                <button type="button" className={bloco} onClick={() => setNomeEditando(grupo.nome)}>
                  <IconPencil size={18} aria-hidden /> Alterar nome
                </button>
                <button
                  type="button"
                  className={bloco}
                  onClick={() => atualizarGrupo({ resource: "grupos", id: grupo.id, values: { ativo: !grupo.ativo } })}
                >
                  {grupo.ativo ? "Inativar grupo" : "Ativar grupo"}
                </button>
                {pode(ROTA, "excluir") && (
                  <button type="button" className={bloco} onClick={() => setExcluir(true)}>
                    <IconTrash size={18} aria-hidden /> Excluir grupo
                  </button>
                )}
              </div>
            )}
          </div>
          {pode(ROTA, "adicionar") && (
            <button
              type="button"
              onClick={() => setNovoGrupo("")}
              className="flex min-h-[76px] flex-col items-center justify-center gap-1 bg-primary px-6 text-xs font-bold uppercase text-primary-foreground hover:bg-primary-dark sm:w-[152px]"
            >
              <IconCirclePlus size={36} stroke={1.5} aria-hidden />
              Novo grupo
            </button>
          )}
          {grupo && (
            <Link
              to="/ajustes/usuarios"
              className="flex min-h-[76px] items-center gap-2 px-4 text-sm font-semibold uppercase text-primary hover:text-primary-dark sm:w-[200px]"
            >
              <IconUsers size={24} aria-hidden />
              {grupo.usuarios} usuário{grupo.usuarios === 1 ? "" : "s"} neste grupo
            </Link>
          )}
        </div>

        {(nomeEditando !== null || novoGrupo !== null) && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (novoGrupo !== null) {
                criarGrupo(
                  { resource: "grupos", values: { nome: novoGrupo.trim() } },
                  { onSuccess: ({ data }) => setGrupoId(data.id as number), onError: (err) => setAviso(err.message) },
                );
                setNovoGrupo(null);
              } else if (grupo) {
                atualizarGrupo({ resource: "grupos", id: grupo.id, values: { nome: nomeEditando!.trim() } });
                setNomeEditando(null);
              }
            }}
          >
            <label className="flex-1">
              <span className="mb-1 block font-label text-sm text-ink-muted">{novoGrupo !== null ? "Nome do novo grupo" : "Novo nome do grupo"}</span>
              <input
                autoFocus
                required
                value={novoGrupo ?? nomeEditando ?? ""}
                onChange={(e) => (novoGrupo !== null ? setNovoGrupo(e.target.value) : setNomeEditando(e.target.value))}
                className="h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none"
              />
            </label>
            <button type="button" onClick={() => (setNovoGrupo(null), setNomeEditando(null))} className="min-h-12 px-4 text-sm font-semibold uppercase text-primary">
              Cancelar
            </button>
            <button type="submit" className="min-h-12 rounded-xs border-2 border-primary px-4 text-sm font-bold uppercase text-primary hover:bg-primary-light">
              Confirmar
            </button>
          </form>
        )}

        <h2 className="mb-4 mt-10 text-2xl font-normal uppercase text-primary md:text-[30px]">Funcionalidades</h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm text-ink">
            <thead>
              <tr className="h-12 text-xs font-bold uppercase text-ink-muted">
                <th scope="col" className="text-left">
                  <span className="sr-only">Funcionalidade</span>
                </th>
                {ACOES.map((a) => (
                  <th key={a} scope="col" className="w-24 text-center">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            {modulos.map(([modulo, itens]) => {
              const codigos = itens.map((f) => f.codigo);
              const aberto = abertos[modulo] ?? false;
              return (
                <tbody key={modulo}>
                  <tr className="h-14 border-b-2 border-surface bg-primary-light">
                    <th scope="row" className="text-left">
                      <button
                        type="button"
                        onClick={() => setAbertos((a) => ({ ...a, [modulo]: !aberto }))}
                        aria-expanded={aberto}
                        className="flex min-h-12 w-full items-center gap-2 px-3 text-sm font-bold uppercase text-primary-dark"
                      >
                        {aberto ? <IconChevronDown size={18} aria-hidden /> : <IconChevronRight size={18} aria-hidden />}
                        {modulo}
                      </button>
                    </th>
                    {ACOES.map((a) => (
                      <td key={a} className="text-center">
                        <Marca
                          rotulo={`${a} em todo o módulo ${modulo}`}
                          marcado={codigos.every((c) => matriz[c]?.[a])}
                          parcial={codigos.some((c) => matriz[c]?.[a])}
                          disabled={!podeAlterar}
                          onChange={(v) => marcar(codigos, a, v)}
                        />
                      </td>
                    ))}
                  </tr>
                  {aberto &&
                    itens.map((f) => (
                      <tr key={f.codigo} className="h-12 border-b border-line">
                        <th scope="row" className="pl-10 text-left text-sm font-semibold uppercase">
                          {f.nome}
                        </th>
                        {ACOES.map((a) => (
                          <td key={a} className="text-center">
                            <Marca
                              rotulo={`${a}: ${f.nome}`}
                              marcado={!!matriz[f.codigo]?.[a]}
                              disabled={!podeAlterar}
                              onChange={(v) => marcar([f.codigo], a, v)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
        </div>

        {aviso && (
          <p role="status" className="mt-6 rounded-xs bg-primary-light px-4 py-3 text-sm font-semibold text-ink">
            {aviso}
          </p>
        )}
      </div>

      {podeAlterar && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
          <div className="mx-auto flex max-w-[992px] justify-end gap-2 px-4 py-3 xl:px-0">
            <button
              type="button"
              onClick={() => matrizQuery.refetch()}
              className="min-h-12 rounded-xs border-2 border-primary px-4 text-sm font-bold uppercase text-primary hover:bg-primary-light"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || grupoId === null}
              className="min-h-12 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {excluir && grupo && (
        <ConfirmDialog
          title="Excluir grupo"
          message={
            grupo.usuarios
              ? `O grupo ${grupo.nome} tem ${grupo.usuarios} usuário(s). Mude o grupo deles antes de excluir.`
              : `Excluir o grupo ${grupo.nome}? Isso não pode ser desfeito.`
          }
          confirmLabel="Excluir"
          onCancel={() => setExcluir(false)}
          onConfirm={() => {
            if (!grupo.usuarios) removerGrupo({ resource: "grupos", id: grupo.id }, { onSuccess: () => setGrupoId(null) });
            setExcluir(false);
          }}
        />
      )}
    </>
  );
}

/** Círculo de marcar da MarketUP, como caixa de seleção acessível de 48px. */
function Marca({ rotulo, marcado, parcial, disabled, onChange }: { rotulo: string; marcado: boolean; parcial?: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex size-12 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={marcado} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={rotulo} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "flex size-5 items-center justify-center rounded-full border-2 border-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-cyan peer-disabled:opacity-50",
          marcado && "bg-primary",
          !marcado && parcial && "bg-primary/30",
        )}
      >
        {marcado && <span className="size-2 rounded-full bg-surface-raised" />}
      </span>
    </label>
  );
}
