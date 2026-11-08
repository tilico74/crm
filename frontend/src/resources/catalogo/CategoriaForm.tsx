import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api, ApiError } from "@/lib/api";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { CampoLinha } from "./campo";
import { ROTA_CATEGORIAS as ROTA } from "./CategoriasList";
import type { Categoria, Subcategoria } from "./types";

// Subcategorias novas ganham um id provisório negativo só na tela; vão para a API sem id.
let provisorio = -1;

/**
 * Ficha da categoria, como na MarketUP: nome da categoria e a lista de subcategorias
 * ("Incluir subcategoria", edição na linha). Tudo é gravado ao clicar em Salvar,
 * e as subcategorias que já existiam mantêm o ID (produtos apontam para ele).
 */
export function CategoriaForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");
  const tabela = useRef<TabelaEditavelRef>(null);
  const [nome, setNome] = useState("");
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [carregando, setCarregando] = useState(editando);
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    api<Categoria>(`/categorias/${id}`).then(
      (c) => {
        setNome(c.nome);
        setSubcategorias(c.subcategorias);
        setCarregando(false);
      },
      (e: ApiError) => {
        setAviso(e.message);
        setCarregando(false);
      },
    );
  }, [editando, id]);

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = {
      nome,
      subcategorias: subcategorias.map((s) => (s.id && s.id > 0 ? { id: s.id, nome: s.nome } : { nome: s.nome })),
    };
    try {
      const salva = await api<Categoria>(editando ? `/categorias/${id}` : "/categorias", {
        method: editando ? "PUT" : "POST",
        body: JSON.stringify(corpo),
      });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salva.id}`, { replace: true });
      else {
        setSubcategorias(salva.subcategorias);
        setAviso("Categoria salva.");
      }
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErros(erro.errors);
        setAviso(erro.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  const erroNome = Array.isArray(erros.nome) ? erros.nome.join(" ") : undefined;

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Categorias" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] pb-28 pt-8">
        <div className="px-4 xl:px-0">
          <TextField label="Categoria" required value={nome} onChange={(e) => setNome(e.target.value)} error={erroNome} disabled={!podeSalvar} />
        </div>

        <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-3 px-4 xl:px-0">
          <h2 className="text-2xl font-normal uppercase text-primary md:text-[30px]">Subcategorias</h2>
          {podeSalvar && (
            <button
              type="button"
              onClick={() => tabela.current?.adicionar()}
              className="min-h-12 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark"
            >
              Incluir subcategoria
            </button>
          )}
        </div>

        <TabelaEditavel<Subcategoria>
          ref={tabela}
          linhas={subcategorias}
          nova={{ nome: "" }}
          descrever={(s) => `Subcategoria ${s.nome || "nova"}`}
          podeEditar={() => podeSalvar}
          podeExcluir={() => podeSalvar}
          onSalvar={async (s) => {
            if (!s.nome.trim()) throw new ApiError(400, { nome: ["Informe o nome da subcategoria."] });
            setSubcategorias((lista) => (s.id ? lista.map((x) => (x.id === s.id ? s : x)) : [...lista, { ...s, id: provisorio-- }]));
          }}
          onExcluir={async (s) => setSubcategorias((lista) => lista.filter((x) => x.id !== s.id))}
          colunas={[
            {
              cabecalho: "Nome",
              campo: "nome",
              exibir: (s) => s.nome,
              editar: (r, set, erro) => <CampoLinha rotulo="Nome da subcategoria" autoFocus valor={r.nome} onChange={(v) => set({ nome: v })} erro={erro} />,
            },
          ]}
          vazio='Nenhuma subcategoria. Use "Incluir subcategoria".'
          avisarAoSalvar={false}
        />
        <p className="px-4 text-xs text-ink-muted xl:px-0">As mudanças nas subcategorias só valem depois de Salvar.</p>

        <div className="px-4 xl:px-0">
          <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
        </div>
      </form>
    </>
  );
}
