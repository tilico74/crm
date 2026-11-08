import { useCreate, useList, useOne, useUpdate, type HttpError } from "@refinedev/core";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { FormSection, SelectField, SwitchField, TextAreaField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { normalizarNome } from "@/lib/normalizarNome";
import { cn } from "@/lib/utils";

import type { Funcionario, Grupo } from "./types";

const ROTA = "/ajustes/funcionarios";

const VAZIO: Omit<Funcionario, "id" | "grupo_nome"> = {
  tipo_pessoa: "F", codigo: "", terceiro: false, bloqueado: false,
  nome: "", apelido: "", cpf: "", rg: "", rg_emissor: "", rg_uf: "", sexo: "", aniversario: null,
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", inscricao_municipal: "",
  telefone: "", celular: "", email: "", site: "", observacao: "",
  login: "", senha: "", grupo: null, comprador: false, vendedor: false, comissao: "0.00",
};

type Dados = typeof VAZIO;
type Erros = Record<string, string[]>;

/** Ficha do funcionário com as seções e a ordem dos campos da MarketUP. */
export function FuncionarioForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");

  const { result: registro, query } = useOne<Funcionario>({ resource: "funcionarios", id, queryOptions: { enabled: editando } });
  const { result: grupos } = useList<Grupo>({ resource: "grupos", pagination: { currentPage: 1, pageSize: 100 } });
  const { mutate: criar, mutation: criacao } = useCreate<Funcionario, HttpError, Dados>();
  const { mutate: atualizar, mutation: atualizacao } = useUpdate<Funcionario, HttpError, Dados>();
  const salvando = criacao.isPending || atualizacao.isPending;

  useEffect(() => {
    if (registro) setDados({ ...VAZIO, ...registro, senha: "" });
  }, [registro]);

  const set = <K extends keyof Dados>(campo: K, valor: Dados[K]) => setDados((d) => ({ ...d, [campo]: valor }));
  const texto = (campo: keyof Dados) => ({
    value: (dados[campo] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => set(campo, e.target.value as never),
    error: erros[campo],
  });
  // Prévia da padronização ao sair do campo; o back-end aplica de novo ao gravar.
  const nomeProprio = (campo: "nome" | "apelido" | "razao_social" | "nome_fantasia") => ({
    ...texto(campo),
    onBlur: () => set(campo, normalizarNome(dados[campo])),
  });

  const salvar = (voltar: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    setErros({});
    setAviso("");
    const corpo = { ...dados, aniversario: dados.aniversario || null };
    if (!corpo.senha) delete corpo.senha;
    const opcoes = {
      onSuccess: ({ data }: { data: Funcionario }) => {
        if (voltar) navigate(ROTA);
        else if (!editando) navigate(`${ROTA}/${data.id}`, { replace: true });
        else setAviso("Funcionário salvo.");
      },
      onError: (erro: HttpError) => {
        setErros((erro.errors as Erros) ?? {});
        setAviso(erro.message);
      },
    };
    if (editando) atualizar({ resource: "funcionarios", id: id!, values: corpo, successNotification: false }, opcoes);
    else criar({ resource: "funcionarios", values: corpo, successNotification: false }, opcoes);
  };

  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");
  const juridica = dados.tipo_pessoa === "J";

  if (editando && query.isLoading) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Empresa" title="Funcionários" />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        {/* Bloco de cabeçalho: quadro de situação (136px) e dados do documento, como na MarketUP. */}
        <div className="mb-10 flex flex-col gap-6 border-2 border-primary p-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => set("bloqueado", !dados.bloqueado)}
            aria-pressed={!dados.bloqueado}
            className={cn(
              "flex h-20 w-full shrink-0 flex-col items-center justify-center rounded-xs font-bold uppercase sm:w-[136px]",
              dados.bloqueado ? "bg-error-soft text-error" : "bg-success-soft text-success",
            )}
          >
            <span className="text-[11px] text-ink-muted">Situação</span>
            {dados.bloqueado ? "Bloqueado" : "Ativo"}
          </button>
          <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <legend className="mb-1 font-label text-sm text-ink-muted">Pessoa Física ou Jurídica?</legend>
            {(["F", "J"] as const).map((t) => (
              <label key={t} className="flex min-h-12 items-center gap-2 text-sm font-semibold [@media(pointer:fine)]:min-h-0">
                <input type="radio" name="tipo_pessoa" checked={dados.tipo_pessoa === t} onChange={() => set("tipo_pessoa", t)} className="size-4 accent-primary" />
                {t === "F" ? "Física" : "Jurídica"}
              </label>
            ))}
            <SwitchField label="Terceiro" checked={dados.terceiro} onChange={(v) => set("terceiro", v)} />
          </fieldset>
          <div className="sm:ml-auto sm:w-40">
            <TextField label="Código" {...texto("codigo")} />
          </div>
        </div>

        <FormSection title="Ficha cadastral">
          <TextField label="Nome" required span={2} autoComplete="off" {...nomeProprio("nome")} />
          <TextField label="Apelido" {...nomeProprio("apelido")} />
          {juridica ? (
            <>
              <TextField label="CNPJ" inputMode="numeric" {...texto("cnpj")} />
              <TextField label="Razão Social" span={2} {...nomeProprio("razao_social")} />
              <TextField label="Nome Fantasia" span={2} {...nomeProprio("nome_fantasia")} />
              <TextField label="Inscrição Estadual" {...texto("inscricao_estadual")} />
              <TextField label="Inscrição Municipal" {...texto("inscricao_municipal")} />
            </>
          ) : (
            <>
              <TextField label="CPF" inputMode="numeric" {...texto("cpf")} />
              <TextField label="RG" {...texto("rg")} />
              <TextField label="Emissor" {...texto("rg_emissor")} />
              <TextField label="UF" maxLength={2} {...texto("rg_uf")} onBlur={() => set("rg_uf", dados.rg_uf.toUpperCase())} />
              <SelectField
                label="Sexo"
                value={dados.sexo}
                onChange={(e) => set("sexo", e.target.value as Dados["sexo"])}
                options={[{ value: "M", label: "Masculino" }, { value: "F", label: "Feminino" }]}
                error={erros.sexo}
              />
              <TextField label="Aniversário" type="date" {...texto("aniversario")} />
            </>
          )}
          <TextField label="Telefone" type="tel" {...texto("telefone")} />
          <TextField label="Celular" type="tel" {...texto("celular")} />
          <TextField label="Email" type="email" span={2} className="normal-case" {...texto("email")} />
          <TextField label="Site" span={2} {...texto("site")} />
          <TextAreaField
            label="Observação"
            value={dados.observacao}
            onChange={(e) => set("observacao", e.target.value)}
            error={erros.observacao}
          />
        </FormSection>

        <FormSection title="Acesso e funções">
          <TextField label="Login" autoComplete="off" {...texto("login")} />
          <TextField
            label="Senha"
            type="password"
            autoComplete="new-password"
            placeholder={dados.login && editando ? "Deixe em branco para manter" : ""}
            {...texto("senha")}
          />
          <SelectField
            label="Perfil (grupo)"
            span={2}
            value={dados.grupo ?? ""}
            onChange={(e) => set("grupo", e.target.value ? Number(e.target.value) : null)}
            options={grupos.data.filter((g) => g.ativo || g.id === dados.grupo).map((g) => ({ value: g.id, label: g.nome }))}
            error={erros.grupo}
          />
          <SwitchField label="Comprador?" checked={dados.comprador} onChange={(v) => set("comprador", v)} />
          <SwitchField label="Vendedor?" checked={dados.vendedor} onChange={(v) => set("vendedor", v)} />
          <TextField label="Comissão (%)" type="number" min={0} max={100} step="0.01" inputMode="decimal" {...texto("comissao")} />
        </FormSection>

        <p className="mt-10 text-sm text-ink-muted">
          Características, endereços, contatos, dados bancários e documentos entram junto com o cadastro de clientes (T102), que usa as mesmas seções.
        </p>

        {aviso && (
          <p role="status" className={cn("mt-6 rounded-xs px-4 py-3 text-sm font-semibold", Object.keys(erros).length ? "bg-error-soft text-error" : "bg-success-soft text-success")}>
            {aviso}
          </p>
        )}

        {/* Barra de ações: fixa embaixo, na largura da coluna. */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
          <div className="mx-auto flex max-w-[992px] items-center gap-2 px-4 py-3 xl:px-0">
            <Link to={ROTA} className="mr-auto inline-flex min-h-12 items-center px-2 text-sm font-semibold uppercase text-primary hover:text-primary-dark">
              Voltar
            </Link>
            {podeSalvar && (
              <>
                <button
                  type="button"
                  onClick={salvar(true)}
                  disabled={salvando}
                  className="min-h-12 rounded-xs border-2 border-primary px-4 text-sm font-bold uppercase text-primary hover:bg-primary-light disabled:opacity-60"
                >
                  Salvar e voltar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="min-h-12 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
