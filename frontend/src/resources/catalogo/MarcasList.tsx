import { useList } from "@refinedev/core";
import { IconPhoto, IconPhotoOff, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";

import { useMe } from "@/app/useMe";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api, ApiError } from "@/lib/api";

import { CampoLinha } from "./campo";
import type { Marca } from "./types";

const ROTA = "/catalogo/marcas";

/** Catálogo › Marcas, como na MarketUP: ID, Nome; edição na linha; "Enviar foto" / "Remover" da imagem. */
export function MarcasList() {
  const { pode } = useMe();
  const tabela = useRef<TabelaEditavelRef>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [termo, setTermo] = useState("");
  const [marcaFoto, setMarcaFoto] = useState<Marca | null>(null);
  const [erroFoto, setErroFoto] = useState("");
  const { result, query } = useList<Marca>({ resource: "marcas", pagination: { mode: "off" }, filters: [{ field: "q", operator: "eq", value: termo }] });
  const podeAlterar = pode(ROTA, "alterar");

  const enviarFoto = async (file: File | undefined) => {
    if (!file || !marcaFoto) return;
    const corpo = new FormData();
    corpo.append("arquivo", file);
    setErroFoto("");
    try {
      await api(`/marcas/${marcaFoto.id}/imagem`, { method: "POST", body: corpo });
      await query.refetch();
    } catch (erro) {
      setErroFoto(erro instanceof ApiError ? erro.message : "Não foi possível enviar a imagem.");
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  };

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Marcas">
        <ListToolbar onSearch={setTermo} onAdd={pode(ROTA, "adicionar") ? () => tabela.current?.adicionar() : undefined} />
      </PageHeader>
      {erroFoto && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{erroFoto}</p>}
      <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => enviarFoto(e.target.files?.[0])} />
      <TabelaEditavel<Marca>
        ref={tabela}
        linhas={[...result.data].sort((a, b) => a.nome.localeCompare(b.nome))}
        carregando={query.isLoading}
        nova={{ nome: "", imagem: null }}
        descrever={(m) => `Marca ${m.nome || "nova"}`}
        podeEditar={() => podeAlterar}
        podeExcluir={() => pode(ROTA, "excluir")}
        onSalvar={async (m) => {
          await api(m.id ? `/marcas/${m.id}` : "/marcas", { method: m.id ? "PATCH" : "POST", body: JSON.stringify({ nome: m.nome }) });
          await query.refetch();
        }}
        onExcluir={async (m) => {
          await api(`/marcas/${m.id}`, { method: "DELETE" });
          await query.refetch();
        }}
        acoesExtras={(m) =>
          podeAlterar && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMarcaFoto(m);
                  arquivo.current?.click();
                }}
                aria-label={`Enviar foto da marca ${m.nome}`}
                title="Enviar foto"
                className="inline-flex size-12 items-center justify-center hover:text-primary"
              >
                <IconUpload size={22} aria-hidden />
              </button>
              {m.imagem && (
                <button
                  type="button"
                  onClick={async () => {
                    await api(`/marcas/${m.id}/imagem`, { method: "DELETE" });
                    await query.refetch();
                  }}
                  aria-label={`Remover foto da marca ${m.nome}`}
                  title="Remover foto"
                  className="inline-flex size-12 items-center justify-center text-error hover:opacity-80"
                >
                  <IconPhotoOff size={22} aria-hidden />
                </button>
              )}
            </>
          )
        }
        colunas={[
          { cabecalho: "ID", classe: "w-16 tabular-nums", exibir: (m) => m.id ?? "—" },
          {
            cabecalho: "Imagem",
            classe: "w-20",
            exibir: (m) =>
              m.imagem ? (
                <img src={m.imagem} alt={`Logo ${m.nome}`} className="h-10 w-16 rounded-xs bg-white object-contain" />
              ) : (
                <IconPhoto size={24} aria-label="Sem imagem" className="text-secondary-light" />
              ),
          },
          {
            cabecalho: "Nome",
            campo: "nome",
            exibir: (m) => m.nome,
            editar: (r, set, erro) => <CampoLinha rotulo="Nome" autoFocus valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
          },
        ]}
        vazio="Nenhuma marca encontrada."
      />
    </>
  );
}
