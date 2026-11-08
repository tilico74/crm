import { useCreate, useList, useOne, useUpdate, type HttpError } from "@refinedev/core";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { FormSection, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

import { BarraAcoes } from "./BarraAcoes";
import { ROTA_CONTAS_GERENCIAIS as ROTA } from "./ContasGerenciaisList";
import { opcoesDre } from "./regras";
import type { ContaGerencial } from "./types";

type Dados = Omit<ContaGerencial, "id" | "tipo_nome" | "classificacao_dre_nome" | "conta_origem_nome">;
type Erros = Record<string, string[]>;

const VAZIO: Dados = {
  tipo: "S", conta_origem: null, posicao_relativa: 0, codigo_referencia: "", classificacao_dre: "",
  nome: "", cc_debito: "", cc_credito: "", compras: false, ativo: true, sistema: false,
};

/** Ficha da conta gerencial, com os campos na ordem da MarketUP (management_account/detail). */
export function ContaGerencialForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");

  const { result: registro, query } = useOne<ContaGerencial>({ resource: "contas-gerenciais", id, queryOptions: { enabled: editando } });
  const { result: contas } = useList<ContaGerencial>({
    resource: "contas-gerenciais",
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "codigo_referencia", order: "asc" }],
  });
  const { mutate: criar, mutation: criacao } = useCreate<ContaGerencial, HttpError, Dados>();
  const { mutate: atualizar, mutation: atualizacao } = useUpdate<ContaGerencial, HttpError, Dados>();
  const salvando = criacao.isPending || atualizacao.isPending;

  useEffect(() => {
    if (registro) setDados({ ...VAZIO, ...registro });
  }, [registro]);

  const set = <K extends keyof Dados>(campo: K, valor: Dados[K]) => setDados((d) => ({ ...d, [campo]: valor }));
  const texto = (campo: "codigo_referencia" | "nome" | "cc_debito" | "cc_credito") => ({
    value: dados[campo],
    onChange: (e: { target: { value: string } }) => set(campo, e.target.value),
    error: erros[campo],
  });

  const salvar = (voltar: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    setErros({});
    setAviso("");
    if (!dados.nome.trim()) {
      setErros({ nome: ["Informe o nome da conta."] });
      setAviso("Confira os campos destacados.");
      return;
    }
    const opcoes = {
      onSuccess: ({ data }: { data: ContaGerencial }) => {
        if (voltar) navigate(ROTA);
        else if (!editando) navigate(`${ROTA}/${data.id}`, { replace: true });
        else setAviso("Conta gerencial salva.");
      },
      onError: (erro: HttpError) => {
        setErros((erro.errors as Erros) ?? {});
        setAviso(erro.message);
      },
    };
    if (editando) atualizar({ resource: "contas-gerenciais", id: id!, values: dados, successNotification: false, errorNotification: false }, opcoes);
    else criar({ resource: "contas-gerenciais", values: dados, successNotification: false, errorNotification: false }, opcoes);
  };

  if (editando && query.isLoading) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  // A conta não pode ficar dentro dela mesma.
  const origens = contas.data.filter((c) => !editando || c.id !== Number(id));
  const dre = opcoesDre(dados.tipo);

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Conta gerencial" />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        {/* Bloco de cabeçalho: quadro de situação (136px) e tipo da conta. */}
        <div className="mb-10 flex flex-col gap-6 border-2 border-primary p-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => set("ativo", !dados.ativo)}
            aria-pressed={dados.ativo}
            className={cn(
              "flex h-20 w-full shrink-0 flex-col items-center justify-center rounded-xs font-bold uppercase sm:w-[136px]",
              dados.ativo ? "bg-success-soft text-success" : "bg-error-soft text-error",
            )}
          >
            <span className="text-[11px] text-ink-muted">Ativo</span>
            {dados.ativo ? "Sim" : "Não"}
          </button>
          <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <legend className="mb-1 font-label text-sm text-ink-muted">Tipo</legend>
            {(["S", "E"] as const).map((t) => (
              <label key={t} className="flex min-h-12 items-center gap-2 text-sm font-semibold [@media(pointer:fine)]:min-h-0">
                <input
                  type="radio"
                  name="tipo"
                  checked={dados.tipo === t}
                  onChange={() =>
                    setDados((d) => ({
                      ...d,
                      tipo: t,
                      // A classificação DRE muda com o tipo: limpa se não servir mais.
                      classificacao_dre: opcoesDre(t).some((o) => o.value === d.classificacao_dre) ? d.classificacao_dre : "",
                    }))
                  }
                  className="size-4 accent-primary"
                />
                {t === "S" ? "Saída" : "Entrada"}
              </label>
            ))}
          </fieldset>
          {dados.sistema && (
            <p className="text-sm font-semibold text-ink-muted sm:ml-auto">Conta do sistema: não pode ser excluída.</p>
          )}
        </div>

        <FormSection title="Dados da conta">
          <SelectField
            label="Conta origem"
            span={2}
            value={dados.conta_origem ?? ""}
            onChange={(e) => set("conta_origem", e.target.value ? Number(e.target.value) : null)}
            options={origens.map((c) => ({ value: c.id, label: [c.codigo_referencia, c.nome].filter(Boolean).join(" ") }))}
            error={erros.conta_origem}
          />
          <TextField
            label="Posição relativa"
            type="number"
            inputMode="numeric"
            step={1}
            value={String(dados.posicao_relativa)}
            onChange={(e) => set("posicao_relativa", Number(e.target.value) || 0)}
            error={erros.posicao_relativa}
          />
          <TextField label="Código referência" placeholder="Ex.: 1.0" {...texto("codigo_referencia")} />
          <SelectField
            label="Classificação DRE"
            span={2}
            value={dados.classificacao_dre}
            onChange={(e) => set("classificacao_dre", e.target.value)}
            options={dre}
            error={erros.classificacao_dre}
          />
          <TextField label="Nome" required span={2} autoComplete="off" {...texto("nome")} />
          <TextField label="CC débito" {...texto("cc_debito")} />
          <TextField label="CC crédito" {...texto("cc_credito")} />
          <SwitchField label="Compras" checked={dados.compras} onChange={(v) => set("compras", v)} />
          <SwitchField label="Ativo" checked={dados.ativo} onChange={(v) => set("ativo", v)} />
        </FormSection>

        <BarraAcoes
          voltar={ROTA}
          aviso={aviso}
          erro={Object.keys(erros).length > 0}
          podeSalvar={pode(ROTA, editando ? "alterar" : "adicionar")}
          salvando={salvando}
          onSalvarEVoltar={salvar(true)}
        />
      </form>
    </>
  );
}
