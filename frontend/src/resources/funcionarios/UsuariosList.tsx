import { useList, useUpdate, type HttpError } from "@refinedev/core";
import { IconUserCircle } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useMe } from "@/app/useMe";
import { PageHeader } from "@/components/PageHeader";
import { formatarPercentual, formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import type { Funcionario } from "./types";

const ROTA_FUNCIONARIOS = "/ajustes/funcionarios";

/**
 * Ajustes › Usuários, como na MarketUP: quem tem login, com o grupo de permissões,
 * a comissão e o "Ativo?" na própria linha. O usuário logado não pode se desativar.
 */
export function UsuariosList() {
  const navigate = useNavigate();
  const { me, pode } = useMe();
  const podeAlterar = pode(ROTA_FUNCIONARIOS, "alterar");
  const [aviso, setAviso] = useState("");

  const { result, query } = useList<Funcionario>({
    resource: "funcionarios",
    pagination: { currentPage: 1, pageSize: 200 },
    sorters: [{ field: "nome", order: "asc" }],
    meta: { params: { com_login: 1 } },
  });
  const { mutate: atualizar } = useUpdate<Funcionario, HttpError>();

  const alternar = (f: Funcionario) => {
    setAviso("");
    atualizar(
      { resource: "funcionarios", id: f.id, values: { bloqueado: !f.bloqueado }, successNotification: false, errorNotification: false },
      { onError: (erro) => setAviso(erro.message) },
    );
  };

  return (
    <>
      <PageHeader eyebrow="Empresa" title="Usuários" />

      <div className="mx-auto max-w-[992px] px-4 pb-10 pt-6 xl:px-0">
        {aviso && <p role="alert" className="mb-4 rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}

        <table className="w-full border-collapse text-sm text-ink">
          <thead className="hidden md:table-header-group">
            <tr className="h-12 border-b border-line text-left text-xs font-bold uppercase text-ink-muted">
              <th scope="col" className="px-2">Usuário</th>
              <th scope="col" className="w-[28%] px-2">Permissões</th>
              <th scope="col" className="w-28 px-2 text-center">Comissão</th>
              <th scope="col" className="w-24 px-2 text-center">Ativo?</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((f) => {
              const euMesmo = me?.username === f.login;
              return (
                <tr key={f.id} className="flex flex-col gap-2 border-b border-line py-3 md:table-row md:py-0">
                  <td className="px-2 md:py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`${ROTA_FUNCIONARIOS}/${f.id}`)}
                      disabled={!podeAlterar}
                      className="flex min-h-12 items-center gap-3 text-left disabled:cursor-default"
                    >
                      <IconUserCircle size={40} stroke={1.2} aria-hidden className="shrink-0 text-secondary-light" />
                      <span>
                        <span className="block text-base font-semibold">{f.nome}</span>
                        <span className="block text-xs text-ink-muted">
                          {[f.email, formatarTelefone(f.celular || f.telefone)].filter(Boolean).join("  |  ")}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="bg-surface px-2 md:py-3">
                    <span className="text-xs text-ink-muted">ERP: </span>
                    <span className="font-semibold">{f.grupo_nome ?? "Sem grupo"}</span>
                  </td>
                  <td className="px-2 text-lg tabular-nums md:text-center">
                    <span className="text-xs text-ink-muted md:hidden">Comissão: </span>
                    {f.vendedor ? formatarPercentual(f.comissao) : <span className="text-ink-muted">N/A</span>}
                  </td>
                  <td className="px-2 md:text-center">
                    {euMesmo ? (
                      <span className="text-xs text-ink-muted" title="Você não pode desativar o próprio usuário">Você</span>
                    ) : (
                      <label className="inline-flex min-h-12 cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={!f.bloqueado} onChange={() => alternar(f)} disabled={!podeAlterar} className="peer sr-only" aria-label={`${f.nome} ativo`} />
                        <span
                          aria-hidden
                          className={cn(
                            "relative h-6 w-11 rounded-full bg-secondary-light transition peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-cyan peer-disabled:opacity-50",
                            "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5",
                          )}
                        />
                        <span className="text-xs md:sr-only">{f.bloqueado ? "Não" : "Sim"}</span>
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {query.isLoading && <p className="py-6 text-ink-muted">Carregando…</p>}
        {!query.isLoading && !result.data.length && <p className="py-6 text-ink-muted">Nenhum funcionário com login. Crie o login na ficha do funcionário.</p>}

        {pode(ROTA_FUNCIONARIOS, "adicionar") && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => navigate(`${ROTA_FUNCIONARIOS}/novo`)}
              className="min-h-12 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark"
            >
              Adicionar novo usuário
            </button>
          </div>
        )}
      </div>
    </>
  );
}
