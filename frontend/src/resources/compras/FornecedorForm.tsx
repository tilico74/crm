import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CepField } from "@/components/CepField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EnderecoField } from "@/components/EnderecoField";
import { FormSection, MaskedField, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { camposDoCep } from "@/lib/localidades";
import { formatarCep, formatarData, formatarMoeda, formatarTelefone, limpar, type TipoMascara } from "@/lib/mascaras";
import { normalizarNome } from "@/lib/normalizarNome";
import { cn } from "@/lib/utils";
import { AbaLista, OnOff } from "@/resources/clientes/AbaLista";
import { Anexo, NovoRapido } from "@/resources/clientes/ClienteForm";
import type { TipoDocumento } from "@/resources/clientes/types";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import {
  ROTA_FORNECEDORES as ROTA,
  TIPOS_PIX,
  type ContaDoFornecedor,
  type ContatoFornecedor,
  type DocumentoFornecedor,
  type EnderecoFornecedor,
  type Fornecedor,
  type TipoFornecedor,
} from "./types";

type Dados = Omit<Fornecedor, "id">;
type Erros = Record<string, unknown>;
type Banco = { id: number; codigo: string; nome: string };

/**
 * Linha da aba Dados bancários: na MarketUP a mesma lista mostra contas ("Conta bancaria") e chaves ("Chave Pix"),
 * escolhidas no select Tipo. `id` é só da tela; `real` é o id gravado (conta ou chave).
 */
type LinhaBancaria = {
  id?: number;
  real?: number;
  tipo: 1 | 2;
  banco: number | null;
  agencia: string;
  agencia_digito: string;
  conta: string;
  conta_digito: string;
  pix_tipo: number | null;
  chave: string;
};

const VAZIO: Dados = {
  tipo_pessoa: "J", tipo: 1, bloqueado: false,
  nome: "", apelido: "", cpf: "", rg: "", rg_emissor: "", rg_uf: "", sexo: "", aniversario: null,
  cnpj: "", indicador_ie: null, inscricao_estadual: "", inscricao_municipal: "",
  telefone: "", celular: "", email: "", site: "", email_nfe: "", observacao: "", transportadora: false, produtor_rural: false,
  enderecos: [], contatos: [], dados_bancarios: [], chaves_pix: [], documentos: [],
};

const ABAS = ["Endereços", "Contatos", "Dados bancários", "Documentos", "Financeiro"] as const;
type Aba = (typeof ABAS)[number];
const ABA_DO_CAMPO: Record<string, Aba> = {
  enderecos: "Endereços", contatos: "Contatos", dados_bancarios: "Dados bancários", chaves_pix: "Dados bancários", documentos: "Documentos",
};

const INDICADORES_IE = [
  { value: 1, label: "Contribuinte do ICMS" },
  { value: 2, label: "Contribuinte Isento de Inscrição" },
  { value: 3, label: "Não Contribuinte" },
];

const ENDERECO_NOVO: EnderecoFornecedor = {
  cep: "", exterior: false, logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", ibge: "", ativo: true, padrao: false,
};
const LINHA_BANCARIA_NOVA: LinhaBancaria = { tipo: 1, banco: null, agencia: "", agencia_digito: "", conta: "", conta_digito: "", pix_tipo: null, chave: "" };

const semIdTemporario = <T extends { id?: number }>(linhas: T[]) => linhas.map(({ id, ...resto }) => (id && id > 0 ? { id, ...resto } : resto));

let proximaLinhaBancaria = 1;
const linhasBancarias = (f: Pick<Dados, "dados_bancarios" | "chaves_pix">): LinhaBancaria[] => [
  ...f.dados_bancarios.map((d) => ({ ...LINHA_BANCARIA_NOVA, id: proximaLinhaBancaria++, real: d.id, tipo: 1 as const, banco: d.banco, agencia: d.agencia, agencia_digito: d.agencia_digito, conta: d.conta, conta_digito: d.conta_digito })),
  ...f.chaves_pix.map((p) => ({ ...LINHA_BANCARIA_NOVA, id: proximaLinhaBancaria++, real: p.id, tipo: 2 as const, pix_tipo: p.tipo, chave: p.chave })),
];

/** Estoque › Compras › Fornecedores: a ficha do cliente da MarketUP com Tipo, Transportadora, Produtor rural e a aba Financeiro. */
export function FornecedorForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");

  const [dados, setDados] = useState<Dados>(VAZIO);
  const [bancarias, setBancarias] = useState<LinhaBancaria[]>([]);
  const [tipoPessoaOriginal, setTipoPessoaOriginal] = useState<"F" | "J">("J");
  const [confirmarTroca, setConfirmarTroca] = useState<boolean | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(editando);
  const [aba, setAba] = useState<Aba>("Endereços");
  const [tipos, setTipos] = useState<TipoFornecedor[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);

  const carregar = (f: Fornecedor) => {
    const { id: _id, ...resto } = f;
    setDados({ ...VAZIO, ...resto });
    setBancarias(linhasBancarias(resto));
    setTipoPessoaOriginal(resto.tipo_pessoa);
  };

  useEffect(() => {
    api<TipoFornecedor[]>("/tipos-fornecedor").then((t) => setTipos([...t].sort((a, b) => a.nome.localeCompare(b.nome))), () => undefined);
    api<TipoDocumento[]>("/tipos-documento").then(setTiposDocumento, () => undefined);
    api<Banco[]>("/bancos").then(setBancos, () => undefined);
    if (!editando) return;
    api<Fornecedor>(`/fornecedores/${id}`).then(
      (f) => {
        carregar(f);
        setCarregando(false);
      },
      (e: ApiError) => {
        setAviso(e.message);
        setCarregando(false);
      },
    );
  }, [editando, id]);

  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));
  const erro = (k: string) => {
    const e = erros[k];
    if (!e) return undefined;
    return Array.isArray(e) ? e.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") : String(e);
  };
  const texto = (k: keyof Dados) => ({
    value: (dados[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    error: erro(k),
    disabled: !podeSalvar,
  });
  const mascarado = (k: "cpf" | "rg" | "cnpj" | "telefone" | "celular", mascara: TipoMascara) => ({
    mascara,
    value: dados[k],
    onChange: (v: string) => set(k, v),
    error: erro(k),
    disabled: !podeSalvar,
  });
  const juridica = dados.tipo_pessoa === "J";
  const nomePessoa = (k: "nome" | "apelido") => ({
    ...texto(k),
    onBlur: () => juridica || set(k, normalizarNome(dados[k]) ?? ""),
  });

  const gravar = async (voltar: boolean) => {
    setSalvando(true);
    setErros({});
    setAviso("");
    const { financeiro: _f, ...resto } = dados;
    const corpo = {
      ...resto,
      aniversario: dados.aniversario || null,
      enderecos: semIdTemporario(dados.enderecos),
      contatos: semIdTemporario(dados.contatos),
      dados_bancarios: bancarias.filter((b) => b.tipo === 1).map((b) => ({
        ...(b.real ? { id: b.real } : {}), banco: b.banco, agencia: b.agencia, agencia_digito: b.agencia_digito, conta: b.conta, conta_digito: b.conta_digito,
      })),
      chaves_pix: bancarias.filter((b) => b.tipo === 2).map((b) => ({ ...(b.real ? { id: b.real } : {}), tipo: b.pix_tipo, chave: b.chave })),
      documentos: semIdTemporario(dados.documentos).map(({ tipo_nome: _t, arquivo: _a, ...l }) => l),
    };
    try {
      const salvo = await api<Fornecedor>(editando ? `/fornecedores/${id}` : "/fornecedores", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else {
        carregar(salvo);
        setAviso("Dados alterados com sucesso.");
      }
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
        const abaComErro = Object.keys(falha.errors).map((k) => ABA_DO_CAMPO[k]).find(Boolean);
        if (abaComErro) setAba(abaComErro);
      }
    } finally {
      setSalvando(false);
    }
  };

  // MarketUP (saveSupplier): trocar física/jurídica num fornecedor gravado pede confirmação, porque apaga os documentos do tipo antigo.
  const salvar = (voltar: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    if (editando && dados.tipo_pessoa !== tipoPessoaOriginal) return setConfirmarTroca(voltar);
    gravar(voltar);
  };

  const criarTipo = async (nome: string) => {
    const novo = await api<TipoFornecedor>("/tipos-fornecedor", { method: "POST", body: JSON.stringify({ nome }) });
    setTipos((t) => [...t, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
    set("tipo", novo.id!);
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Compras" title="Fornecedores" />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <FormSection title="Ficha cadastral">
          <fieldset className="sm:col-span-2" disabled={!podeSalvar}>
            <legend className="mb-1 font-label text-sm text-ink-muted">Pessoa Física ou Jurídica?</legend>
            <div className="flex gap-6">
              {(["F", "J"] as const).map((t) => (
                <label key={t} className="flex min-h-12 items-center gap-2 text-sm [@media(pointer:fine)]:min-h-[34px]">
                  <input type="radio" name="tipo_pessoa" checked={dados.tipo_pessoa === t} onChange={() => set("tipo_pessoa", t)} className="size-4 accent-primary" />
                  {t === "F" ? "Física" : "Jurídica"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-end gap-1">
            <div className="flex-1">
              <SelectField
                label="Tipo"
                value={dados.tipo}
                onChange={(e) => set("tipo", Number(e.target.value))}
                options={tipos.map((t) => ({ value: t.id!, label: t.nome }))}
                error={erro("tipo")}
                disabled={!podeSalvar}
              />
            </div>
            {podeSalvar && <NovoRapido rotulo="Novo tipo de fornecedor" onCriar={criarTipo} />}
          </div>
          <div>
            <span className="mb-1 block font-label text-sm text-ink-muted">Bloqueado</span>
            <SwitchField label={dados.bloqueado ? "Sim" : "Não"} checked={dados.bloqueado} onChange={(v) => podeSalvar && set("bloqueado", v)} />
          </div>

          {juridica ? (
            <>
              <TextField key="razao" label="Razão Social" required span={2} maxLength={300} {...texto("nome")} />
              <TextField key="fantasia" label="Nome Fantasia" span={2} maxLength={300} {...texto("apelido")} />
              <MaskedField key="cnpj" label="CNPJ" {...mascarado("cnpj", "cnpj")} />
              <SelectField
                label="Indicador da IE do Destinatário"
                value={dados.indicador_ie ?? ""}
                onChange={(e) => set("indicador_ie", e.target.value ? (Number(e.target.value) as 1 | 2 | 3) : null)}
                options={INDICADORES_IE}
                error={erro("indicador_ie")}
                disabled={!podeSalvar}
              />
              <TextField label="Inscrição Estadual" maxLength={20} {...texto("inscricao_estadual")} />
              <TextField label="Inscrição Municipal" maxLength={20} {...texto("inscricao_municipal")} />
            </>
          ) : (
            <>
              <TextField key="nome" label="Nome" required span={2} maxLength={300} autoComplete="off" {...nomePessoa("nome")} />
              <TextField key="apelido" label="Apelido" span={2} maxLength={300} {...nomePessoa("apelido")} />
              <MaskedField key="cpf" label="CPF" {...mascarado("cpf", "cpf")} />
              <MaskedField key="rg" label="RG" {...mascarado("rg", "rg")} />
              <div className="grid grid-cols-[1fr_72px] gap-x-4">
                <TextField label="Emissor" maxLength={100} {...texto("rg_emissor")} />
                <TextField label="UF" maxLength={2} {...texto("rg_uf")} onBlur={() => set("rg_uf", dados.rg_uf.toUpperCase())} />
              </div>
              <SelectField
                label="Sexo"
                value={dados.sexo}
                onChange={(e) => set("sexo", e.target.value as Dados["sexo"])}
                options={[{ value: "M", label: "Masculino" }, { value: "F", label: "Feminino" }]}
                error={erro("sexo")}
                disabled={!podeSalvar}
              />
              <TextField label="Aniversário" type="date" {...texto("aniversario")} />
            </>
          )}
          <MaskedField label="Telefone" {...mascarado("telefone", "telefone")} />
          <MaskedField label="Celular" {...mascarado("celular", "telefone")} />
          <TextField label="Email" type="email" className="normal-case" maxLength={254} {...texto("email")} />
          <TextField label="Site" type="url" placeholder="Ex: http://www.site.com.br" className="normal-case" maxLength={150} {...texto("site")} />
          <TextField label="Email do Destinatário da NFe" type="email" span={2} className="normal-case" maxLength={254} {...texto("email_nfe")} />
          <TextField label="Observação" span={2} maxLength={300} {...texto("observacao")} />
          <div className="flex flex-wrap items-end gap-x-6 sm:col-span-2">
            <SwitchField label="É transportadora?" checked={dados.transportadora} onChange={(v) => podeSalvar && set("transportadora", v)} />
            <SwitchField label="Produtor Rural?" checked={dados.produtor_rural} onChange={(v) => podeSalvar && set("produtor_rural", v)} />
          </div>
        </FormSection>

        <h2 className="mb-3 mt-10 text-2xl font-normal uppercase text-primary md:text-[30px]">Características</h2>
        <div role="tablist" aria-label="Características" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {ABAS.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={cn("min-h-12 border-r border-surface-raised/30 text-sm font-bold uppercase", aba === a ? "bg-primary text-primary-foreground" : "bg-secondary text-surface-raised hover:opacity-90")}
            >
              {a}
              {Object.keys(erros).some((k) => ABA_DO_CAMPO[k] === a) && <span className="ml-1 text-error" aria-label="com erro">●</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={aba} className="border border-t-0 border-secondary p-4">
          {Object.keys(erros).some((k) => ABA_DO_CAMPO[k] === aba) && (
            <p role="alert" className="mb-3 rounded-xs bg-error-soft px-3 py-2 text-sm font-semibold text-error">
              {erro(Object.keys(erros).find((k) => ABA_DO_CAMPO[k] === aba)!)}
            </p>
          )}

          {aba === "Endereços" && (
            <AbaLista<EnderecoFornecedor>
              nova={ENDERECO_NOVO}
              linhas={dados.enderecos}
              onChange={(l) => set("enderecos", l)}
              podeSalvar={podeSalvar}
              vazio="Nenhum endereço informado para este fornecedor até o momento!"
              validar={(e) => (!e.logradouro.trim() ? "Informe o endereço (ou busque pelo CEP)." : null)}
              campos={(e, setE) => (
                <>
                  {!e.exterior && (
                    <CepField value={e.cep} onChange={(cep) => setE({ cep: limpar("cep", cep) })} onEndereco={(r) => setE(camposDoCep(r))} />
                  )}
                  <div className="sm:col-span-2">
                    <EnderecoField
                      label="Endereço"
                      value={e.logradouro}
                      maxLength={100}
                      uf={e.uf}
                      cidade={e.cidade}
                      onChange={(v) => setE({ logradouro: v })}
                      onEndereco={(r) => setE({ cep: limpar("cep", r.cep), ...camposDoCep(r) })}
                    />
                    <label className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                      <input type="checkbox" checked={e.exterior} onChange={(ev) => setE({ exterior: ev.target.checked, ...(ev.target.checked ? { cep: "", ibge: "" } : {}) })} className="accent-primary" />
                      Endereço no exterior
                    </label>
                  </div>
                  <TextField label="Nº" maxLength={10} value={e.numero} onChange={(ev) => setE({ numero: ev.target.value })} />
                  <TextField label="Complemento" maxLength={50} value={e.complemento} onChange={(ev) => setE({ complemento: ev.target.value })} />
                  <TextField label="Bairro" maxLength={50} value={e.bairro} onChange={(ev) => setE({ bairro: ev.target.value })} />
                  <TextField label="Cidade" maxLength={80} value={e.cidade} onChange={(ev) => setE({ cidade: ev.target.value, ibge: "" })} />
                  <TextField label="UF" maxLength={2} value={e.uf} onChange={(ev) => setE({ uf: ev.target.value.toUpperCase(), ibge: "" })} />
                </>
              )}
              colunas={[
                { cabecalho: "CEP", exibir: (e) => (e.exterior ? "Exterior" : formatarCep(e.cep) || "—"), classe: "tabular-nums w-24" },
                {
                  cabecalho: "Endereço",
                  exibir: (e) => [e.logradouro, e.numero].filter(Boolean).join(", ") + (e.complemento ? ` - ${e.complemento}` : "") + (e.cidade ? ` (${e.cidade}/${e.uf})` : ""),
                },
                { cabecalho: "Bairro", exibir: (e) => e.bairro || "—" },
                {
                  cabecalho: "Ativo",
                  classe: "w-24",
                  exibir: (e) => (
                    <OnOff rotulo="Endereço ativo" valor={e.ativo} disabled={!podeSalvar} onChange={(v) => set("enderecos", dados.enderecos.map((x) => (x.id === e.id ? { ...x, ativo: v, padrao: v && x.padrao } : x)))} />
                  ),
                },
                {
                  cabecalho: "Padrão",
                  classe: "w-24",
                  exibir: (e) => (
                    <OnOff
                      rotulo="Endereço padrão"
                      valor={e.padrao}
                      disabled={!podeSalvar}
                      onChange={(v) => set("enderecos", dados.enderecos.map((x) => ({ ...x, padrao: x.id === e.id ? v : v ? false : x.padrao, ativo: x.id === e.id && v ? true : x.ativo })))}
                    />
                  ),
                },
              ]}
            />
          )}

          {aba === "Contatos" && (
            <AbaLista<ContatoFornecedor>
              nova={{ nome: "", cargo: "", telefone: "", email: "" }}
              linhas={dados.contatos}
              onChange={(l) => set("contatos", l)}
              podeSalvar={podeSalvar}
              vazio="Nenhum contato informado para este fornecedor até o momento!"
              validar={(c) => (!c.nome.trim() ? "Informe o nome do contato." : null)}
              campos={(c, setC) => (
                <>
                  <TextField label="Nome" span={2} maxLength={300} value={c.nome} onChange={(e) => setC({ nome: e.target.value })} onBlur={() => setC({ nome: normalizarNome(c.nome) ?? "" })} />
                  <TextField label="Cargo" maxLength={150} value={c.cargo} onChange={(e) => setC({ cargo: e.target.value })} />
                  <MaskedField label="Telefone" mascara="telefone" value={c.telefone} onChange={(v) => setC({ telefone: v })} />
                  <TextField label="Email" type="email" span={2} className="normal-case" maxLength={254} value={c.email} onChange={(e) => setC({ email: e.target.value })} />
                </>
              )}
              colunas={[
                { cabecalho: "Nome", exibir: (c) => c.nome },
                { cabecalho: "Cargo", exibir: (c) => c.cargo || "—" },
                { cabecalho: "Telefone", exibir: (c) => formatarTelefone(c.telefone) || "—", classe: "tabular-nums" },
                { cabecalho: "Email", exibir: (c) => <span className="normal-case">{c.email || "—"}</span> },
              ]}
            />
          )}

          {aba === "Dados bancários" && (
            <AbaLista<LinhaBancaria>
              nova={LINHA_BANCARIA_NOVA}
              linhas={bancarias}
              onChange={setBancarias}
              podeSalvar={podeSalvar}
              vazio="Nenhum dado bancário informado para este fornecedor até o momento!"
              validar={(b) =>
                b.tipo === 1
                  ? !b.banco ? "Escolha o banco." : !b.conta.trim() ? "Informe a conta." : null
                  : !b.pix_tipo ? "Escolha o tipo da chave." : !b.chave.trim() ? "Informe a chave Pix." : null
              }
              campos={(b, setB) => (
                <>
                  <SelectField
                    label="Tipo"
                    value={b.tipo}
                    onChange={(e) => setB({ tipo: Number(e.target.value) as 1 | 2 })}
                    options={[{ value: 1, label: "Conta bancaria" }, { value: 2, label: "Chave Pix" }]}
                  />
                  {b.tipo === 1 ? (
                    <>
                      <SelectField
                        label="Banco"
                        span={2}
                        value={b.banco ?? ""}
                        onChange={(e) => setB({ banco: e.target.value ? Number(e.target.value) : null })}
                        options={bancos.map((x) => ({ value: x.id, label: `${x.codigo} - ${x.nome}` }))}
                      />
                      <div className="grid grid-cols-[1fr_64px] gap-x-2">
                        <TextField label="Agência" maxLength={20} inputMode="numeric" value={b.agencia} onChange={(e) => setB({ agencia: e.target.value })} />
                        <TextField label="Dígito" maxLength={20} value={b.agencia_digito} onChange={(e) => setB({ agencia_digito: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-[1fr_64px] gap-x-2 sm:col-span-2">
                        <TextField label="Conta" maxLength={20} inputMode="numeric" value={b.conta} onChange={(e) => setB({ conta: e.target.value })} />
                        <TextField label="Dígito" maxLength={20} value={b.conta_digito} onChange={(e) => setB({ conta_digito: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <>
                      <SelectField
                        label="Tipo da Chave"
                        value={b.pix_tipo ?? ""}
                        onChange={(e) => setB({ pix_tipo: e.target.value ? Number(e.target.value) : null })}
                        options={TIPOS_PIX.map((t) => ({ value: t.value, label: t.label }))}
                      />
                      <TextField label="Chave Pix" span={3} maxLength={100} className="normal-case" value={b.chave} onChange={(e) => setB({ chave: e.target.value })} />
                    </>
                  )}
                </>
              )}
              colunas={[
                { cabecalho: "Tipo/Nº Banco", exibir: (b) => (b.tipo === 1 ? bancos.find((x) => x.id === b.banco)?.codigo ?? "—" : `PIX ${TIPOS_PIX.find((t) => t.value === b.pix_tipo)?.label ?? ""}`) },
                { cabecalho: "Chave/Banco", exibir: (b) => (b.tipo === 1 ? bancos.find((x) => x.id === b.banco)?.nome ?? "—" : <span className="normal-case">{b.chave}</span>) },
                { cabecalho: "Agência", exibir: (b) => (b.tipo === 1 ? [b.agencia, b.agencia_digito].filter(Boolean).join("-") : "—"), classe: "tabular-nums" },
                { cabecalho: "Conta", exibir: (b) => (b.tipo === 1 ? [b.conta, b.conta_digito].filter(Boolean).join("-") : "—"), classe: "tabular-nums" },
              ]}
            />
          )}

          {aba === "Documentos" && (
            <AbaLista<DocumentoFornecedor>
              nova={{ tipo: null, documento: "" }}
              linhas={dados.documentos}
              onChange={(l) => set("documentos", l.map((d) => ({ ...d, tipo_nome: tiposDocumento.find((t) => t.id === d.tipo)?.nome })))}
              podeSalvar={podeSalvar}
              vazio="Nenhum documento informado para este fornecedor até o momento!"
              validar={(d) => (!d.tipo ? "Escolha o tipo do documento." : !d.documento.trim() ? "Informe o documento." : null)}
              campos={(d, setD) => (
                <>
                  <div className="flex items-end gap-1 sm:col-span-2">
                    <div className="flex-1">
                      <SelectField
                        label="Tipo"
                        value={d.tipo ?? ""}
                        onChange={(e) => setD({ tipo: e.target.value ? Number(e.target.value) : null })}
                        options={tiposDocumento.map((t) => ({ value: t.id, label: t.nome }))}
                      />
                    </div>
                    {pode("/vendas/clientes", "adicionar") && (
                      <NovoRapido
                        rotulo="Novo tipo de documento"
                        onCriar={async (nome) => {
                          const tipo = await api<TipoDocumento>("/tipos-documento", { method: "POST", body: JSON.stringify({ nome }) });
                          setTiposDocumento((t) => [...t, tipo].sort((a, b) => a.nome.localeCompare(b.nome)));
                          setD({ tipo: tipo.id });
                        }}
                      />
                    )}
                  </div>
                  <TextField label="Documento" span={4} maxLength={300} value={d.documento} onChange={(e) => setD({ documento: e.target.value })} />
                </>
              )}
              colunas={[
                { cabecalho: "Tipo", exibir: (d) => d.tipo_nome ?? "—" },
                { cabecalho: "Documento", exibir: (d) => d.documento },
              ]}
              acoes={(d) => (
                <Anexo
                  recurso="fornecedores"
                  documento={d}
                  clienteId={editando ? Number(id) : null}
                  podeSalvar={podeSalvar}
                  onAnexo={(arquivo) => set("documentos", dados.documentos.map((x) => (x.id === d.id ? { ...x, arquivo } : x)))}
                  onErro={setAviso}
                />
              )}
            />
          )}

          {aba === "Financeiro" && <AbaFinanceiro nome={dados.nome} financeiro={dados.financeiro ?? null} />}
        </div>

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
      {confirmarTroca !== null && (
        <ConfirmDialog
          title="Tipo de pessoa"
          message="Você alterou o tipo de pessoa (pessoa física/pessoa jurídica). Os dados do tipo de pessoa antigo (CPF e RG ou CNPJ e IE) serão apagados. Deseja continuar?"
          confirmLabel="Continuar"
          neutro
          onCancel={() => setConfirmarTroca(null)}
          onConfirm={() => {
            const voltar = confirmarTroca;
            setConfirmarTroca(null);
            gravar(voltar);
          }}
        />
      )}
    </>
  );
}

const SUBABAS = [
  { chave: "vencida", rotulo: "Vencidas" },
  { chave: "a_vencer", rotulo: "A vencer" },
  { chave: "paga", rotulo: "Pagas/Recebidas" },
] as const;

/**
 * Aba Financeiro (supplier-credit da MarketUP): Total vencidas · Total a vencer · Total pagas; "Parcelas do fornecedor"
 * em Vencidas / A vencer / Pagas; marcar e pagar: uma conta abre a conta a pagar, várias vão para "pagar várias".
 */
function AbaFinanceiro({ nome, financeiro }: { nome: string; financeiro: Fornecedor["financeiro"] | null }) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<(typeof SUBABAS)[number]["chave"]>("vencida");
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  if (!financeiro) return <p className="py-6 text-center text-sm font-semibold uppercase text-ink-muted">Salve o fornecedor para ver as contas dele.</p>;
  const contas = financeiro.contas.filter((c) => c.situacao === sub);
  const pagar = () => {
    const escolhidas = financeiro.contas.filter((c) => marcadas.has(c.id));
    if (escolhidas.length === 1) return navigate(`/financeiro/contas-a-pagar/${escolhidas[0].id}`);
    navigate("/financeiro/contas-a-pagar/baixar", { state: { titulos: escolhidas.map((c: ContaDoFornecedor) => ({ ...c, pessoa_nome: nome })) } });
  };
  return (
    <div>
      <dl className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
        {[
          ["Total vencidas", financeiro.totais.vencidas],
          ["Total a vencer", financeiro.totais.a_vencer],
          ["Total pagas", financeiro.totais.pagas],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string}>
            <dt className="text-sm font-bold uppercase text-ink">{rotulo}</dt>
            <dd className="tabular-nums text-ink-muted">{formatarMoeda(Number(valor))}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-center text-xs uppercase text-ink-muted">Parcelas do fornecedor</p>
      <div role="tablist" aria-label="Parcelas do fornecedor" className="mt-2 flex justify-center gap-2">
        {SUBABAS.map((s) => (
          <button
            key={s.chave}
            type="button"
            role="tab"
            aria-selected={sub === s.chave}
            onClick={() => { setSub(s.chave); setMarcadas(new Set()); }}
            className={cn("min-h-12 px-4 text-xs font-bold uppercase md:min-h-9", sub === s.chave ? "bg-primary text-primary-foreground" : "bg-line text-ink-muted hover:text-ink")}
          >
            {s.rotulo}
          </button>
        ))}
      </div>
      {contas.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold uppercase text-ink-muted">Nenhuma parcela.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
                <th className="w-10" />
                <th className="px-2 py-2">Vencimento</th>
                <th className="px-2 py-2">Conta</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Saldo</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-b border-line">
                  <td className="px-2">
                    {c.situacao !== "paga" && (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${c.descricao}`}
                        checked={marcadas.has(c.id)}
                        onChange={(e) => setMarcadas((m) => { const n = new Set(m); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                        className="size-5 accent-primary"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatarData(c.vencimento)}</td>
                  <td className="px-2 py-2">{c.descricao}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", c.situacao === "vencida" && "text-error")}>{formatarMoeda(Number(c.valor))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatarMoeda(Number(c.saldo))}</td>
                  <td className="text-right">
                    <Link to={`/financeiro/contas-a-pagar/${c.id}`} aria-label={`Abrir ${c.descricao}`} title="Abrir" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9">
                      <IconSearch size={20} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sub !== "paga" && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={pagar}
            disabled={marcadas.size === 0}
            className="min-h-12 rounded-xs bg-secondary px-4 text-xs font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted md:min-h-9"
          >
            Pagar selecionados
          </button>
        </div>
      )}
    </div>
  );
}
