import { IconFileText, IconPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CepField } from "@/components/CepField";
import { EnderecoField } from "@/components/EnderecoField";
import { FormSection, MaskedField, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { camposDoCep } from "@/lib/localidades";
import { formatarCep, formatarData, formatarMoeda, formatarTelefone, limpar, type TipoMascara } from "@/lib/mascaras";
import { normalizarNome } from "@/lib/normalizarNome";
import { cn } from "@/lib/utils";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";
import { ROTA_ORCAMENTOS } from "@/resources/orcamentos/OrcamentosList";
import { ROTA_PEDIDOS } from "@/resources/pedidos/types";

import { AbaLista, OnOff } from "./AbaLista";
import { ROTA_CLIENTES as ROTA } from "./ClientesList";
import type {
  Cliente,
  ContatoCliente,
  DadoBancarioCliente,
  DocumentoCliente,
  EnderecoCliente,
  HistoricoCliente,
  ListaPreco,
  TipoDocumento,
} from "./types";

type Dados = Omit<Cliente, "id">;
type Erros = Record<string, unknown>;
type Banco = { id: number; codigo: string; nome: string };

const VAZIO: Dados = {
  tipo_pessoa: "F", lista_preco: 1, bloqueado: false,
  nome: "", apelido: "", cpf: "", rg: "", rg_emissor: "", rg_uf: "", sexo: "", aniversario: null,
  cnpj: "", indicador_ie: 3, inscricao_estadual: "", inscricao_municipal: "",
  telefone: "", celular: "", email: "", site: "", observacao: "", limite_credito: "0.00",
  email_nfe: "", iss_retido: false, consumidor_final: false, produtor_rural: false,
  enderecos: [], contatos: [], dados_bancarios: [], documentos: [], historico: [],
};

const ABAS = ["Endereços", "Contatos", "Dados bancários", "Documentos", "Crédito", "Histórico"] as const;
type Aba = (typeof ABAS)[number];
const ABA_DO_CAMPO: Record<string, Aba> = {
  enderecos: "Endereços", contatos: "Contatos", dados_bancarios: "Dados bancários", documentos: "Documentos", historico: "Histórico",
};

const INDICADORES_IE = [
  { value: 1, label: "Contribuinte do ICMS" },
  { value: 2, label: "Contribuinte Isento de Inscrição" },
  { value: 3, label: "Não Contribuinte" },
];

const ENDERECO_NOVO: EnderecoCliente = {
  cep: "", exterior: false, logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", ibge: "", ativo: true, padrao: false,
};
const hoje = () => new Date().toISOString().slice(0, 10);

/** Linha automática do Histórico (orçamento ou pedido do cliente), vinda de /clientes/{id}/historico. */
type DocumentoHistorico = { origem: "orcamento" | "pedido"; origem_id: number; chave: number; data: string; descricao: string; status: string };
/** Linha da aba Histórico: anotação digitada ou, com `documento`, orçamento/pedido só de leitura. */
type LinhaHistorico = HistoricoCliente & { documento?: DocumentoHistorico };
const linhaDoDocumento = (d: DocumentoHistorico): LinhaHistorico => ({ data: d.data, descricao: d.descricao, status: 1, documento: d });
// Cores do status atual do documento (as mesmas das listagens).
const COR_STATUS_DOCUMENTO: Record<string, string> = {
  NOVO: "text-primary", PEDIDO: "text-warning-ink", FATURADO: "text-warning-ink", "CONCLUÍDO": "text-success", CANCELADO: "text-error",
};

/** Linhas novas têm id negativo só na tela: vão sem id para a API criar. */
const semIdTemporario = <T extends { id?: number }>(linhas: T[]) => linhas.map(({ id, ...resto }) => (id && id > 0 ? { id, ...resto } : resto));

/** Vendas › Clientes: ficha com as seções, a ordem dos campos e as abas da MarketUP. */
export function ClienteForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");

  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(editando);
  const [aba, setAba] = useState<Aba>("Endereços");
  const [listas, setListas] = useState<ListaPreco[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  // Histórico: orçamentos e pedidos do cliente (linhas automáticas, de 5 em 5 como na MarketUP).
  const [documentos, setDocumentos] = useState<DocumentoHistorico[]>([]);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [paginaDocumentos, setPaginaDocumentos] = useState(0);

  const carregarDocumentos = (pagina: number) =>
    api<{ count: number; results: DocumentoHistorico[] }>(`/clientes/${id}/historico?page=${pagina}`).then((r) => {
      setDocumentos((atuais) => (pagina === 1 ? r.results : [...atuais, ...r.results]));
      setTotalDocumentos(r.count);
      setPaginaDocumentos(pagina);
    }, () => undefined);

  useEffect(() => {
    if (editando) carregarDocumentos(1);
  }, [editando, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api<{ results: ListaPreco[] }>("/listas-precos?page_size=200").then((r) => setListas(r.results), () => undefined);
    api<TipoDocumento[]>("/tipos-documento").then(setTiposDocumento, () => undefined);
    api<Banco[]>("/bancos").then(setBancos, () => undefined);
    if (!editando) return;
    api<Cliente>(`/clientes/${id}`).then(
      ({ id: _id, ...c }) => {
        setDados({ ...VAZIO, ...c });
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
  // ADR-007: só nome de pessoa (pessoa física) é padronizado; razão social e fantasia ficam como digitadas.
  const nomePessoa = (k: "nome" | "apelido") => ({
    ...texto(k),
    onBlur: () => juridica || set(k, normalizarNome(dados[k]) ?? ""),
  });

  const juridica = dados.tipo_pessoa === "J";

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const { credito: _credito, ...resto } = dados;
    const corpo = {
      ...resto,
      aniversario: dados.aniversario || null,
      enderecos: semIdTemporario(dados.enderecos),
      contatos: semIdTemporario(dados.contatos),
      dados_bancarios: semIdTemporario(dados.dados_bancarios).map(({ banco_nome: _b, ...l }) => l),
      documentos: semIdTemporario(dados.documentos).map(({ tipo_nome: _t, arquivo: _a, ...l }) => l),
      historico: semIdTemporario(dados.historico),
    };
    try {
      const salvo = await api<Cliente>(editando ? `/clientes/${id}` : "/clientes", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else {
        const { id: _id, ...c } = salvo;
        setDados({ ...VAZIO, ...c });
        setAviso("Cliente salvo.");
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

  const criarLista = async (nome: string) => {
    const nova = await api<ListaPreco>("/listas-precos", { method: "POST", body: JSON.stringify({ nome }) });
    setListas((l) => [...l, nova]);
    set("lista_preco", nova.id);
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Clientes" />

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
                label="Tipo (Lista de Preços)"
                value={dados.lista_preco}
                onChange={(e) => set("lista_preco", Number(e.target.value))}
                options={listas.map((l) => ({ value: l.id, label: l.nome }))}
                error={erro("lista_preco")}
                disabled={!podeSalvar}
              />
            </div>
            {podeSalvar && pode("/vendas/listas-de-precos", "adicionar") && <NovoRapido rotulo="Nova lista de preços" onCriar={criarLista} />}
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
                value={dados.indicador_ie}
                onChange={(e) => set("indicador_ie", Number(e.target.value) as Dados["indicador_ie"])}
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
          <TextField label="Site" type="url" placeholder="Ex: http://www.site.com.br" className="normal-case" maxLength={64} {...texto("site")} />
          <TextField label="Observação" span={3} maxLength={300} {...texto("observacao")} />
          <TextField label="Limite de Crédito" type="number" min={0} step="0.01" inputMode="decimal" className="text-right tabular-nums" {...texto("limite_credito")} />
        </FormSection>

        <FormSection title="Dados fiscais">
          <TextField label="Email do Destinatário da NFe" type="email" span={2} className="normal-case" maxLength={254} {...texto("email_nfe")} />
          <div className="flex flex-wrap items-end gap-x-6 sm:col-span-2">
            <SwitchField label="ISS Retido na Fonte?" checked={dados.iss_retido} onChange={(v) => podeSalvar && set("iss_retido", v)} />
            <SwitchField label="Consumidor Final?" checked={dados.consumidor_final} onChange={(v) => podeSalvar && set("consumidor_final", v)} />
            <SwitchField label="Produtor Rural?" checked={dados.produtor_rural} onChange={(v) => podeSalvar && set("produtor_rural", v)} />
          </div>
        </FormSection>

        <h2 className="mb-3 mt-10 text-2xl font-normal uppercase text-primary md:text-[30px]">Características</h2>
        <div role="tablist" aria-label="Características" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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
            <AbaLista<EnderecoCliente>
              nova={ENDERECO_NOVO}
              linhas={dados.enderecos}
              onChange={(l) => set("enderecos", l)}
              podeSalvar={podeSalvar}
              vazio="Nenhum endereço informado para este cliente até o momento!"
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
            <AbaLista<ContatoCliente>
              nova={{ nome: "", cargo: "", telefone: "", email: "" }}
              linhas={dados.contatos}
              onChange={(l) => set("contatos", l)}
              podeSalvar={podeSalvar}
              vazio="Nenhum contato informado para este cliente até o momento!"
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
            <AbaLista<DadoBancarioCliente>
              nova={{ banco: null, agencia: "", agencia_digito: "", conta: "", conta_digito: "" }}
              linhas={dados.dados_bancarios}
              onChange={(l) => set("dados_bancarios", l.map((d) => ({ ...d, banco_nome: rotuloBanco(bancos, d.banco) })))}
              podeSalvar={podeSalvar}
              vazio="Nenhum dado bancário informado para este cliente até o momento!"
              validar={(d) => (!d.banco ? "Escolha o banco." : !d.conta.trim() ? "Informe a conta." : null)}
              campos={(d, setD) => (
                <>
                  <SelectField
                    label="Banco"
                    span={2}
                    value={d.banco ?? ""}
                    onChange={(e) => setD({ banco: e.target.value ? Number(e.target.value) : null })}
                    options={bancos.map((b) => ({ value: b.id, label: `${b.codigo} - ${b.nome}` }))}
                  />
                  <TextField label="Agência" maxLength={20} inputMode="numeric" value={d.agencia} onChange={(e) => setD({ agencia: e.target.value })} />
                  <TextField label="Dígito" maxLength={20} value={d.agencia_digito} onChange={(e) => setD({ agencia_digito: e.target.value })} />
                  <TextField label="Conta" maxLength={20} inputMode="numeric" value={d.conta} onChange={(e) => setD({ conta: e.target.value })} />
                  <TextField label="Dígito" maxLength={20} value={d.conta_digito} onChange={(e) => setD({ conta_digito: e.target.value })} />
                </>
              )}
              colunas={[
                { cabecalho: "Banco", exibir: (d) => d.banco_nome ?? rotuloBanco(bancos, d.banco) },
                { cabecalho: "Agência", exibir: (d) => [d.agencia, d.agencia_digito].filter(Boolean).join("-"), classe: "tabular-nums" },
                { cabecalho: "Conta", exibir: (d) => [d.conta, d.conta_digito].filter(Boolean).join("-"), classe: "tabular-nums" },
              ]}
            />
          )}

          {aba === "Documentos" && (
            <AbaLista<DocumentoCliente>
              nova={{ tipo: null, documento: "" }}
              linhas={dados.documentos}
              onChange={(l) => set("documentos", l.map((d) => ({ ...d, tipo_nome: tiposDocumento.find((t) => t.id === d.tipo)?.nome })))}
              podeSalvar={podeSalvar}
              vazio="Nenhum documento informado para este cliente até o momento!"
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
                    <NovoRapido
                      rotulo="Novo tipo de documento"
                      onCriar={async (nome) => {
                        const tipo = await api<TipoDocumento>("/tipos-documento", { method: "POST", body: JSON.stringify({ nome }) });
                        setTiposDocumento((t) => [...t, tipo].sort((a, b) => a.nome.localeCompare(b.nome)));
                        setD({ tipo: tipo.id });
                      }}
                    />
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
                  documento={d}
                  clienteId={editando ? Number(id) : null}
                  podeSalvar={podeSalvar}
                  onAnexo={(arquivo) => set("documentos", dados.documentos.map((x) => (x.id === d.id ? { ...x, arquivo } : x)))}
                  onErro={setAviso}
                />
              )}
            />
          )}

          {aba === "Crédito" && (
            <div>
              <dl className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
                {[
                  ["Limite de crédito", Number(dados.limite_credito || 0)],
                  ["Limite utilizado", Number(dados.credito?.utilizado ?? 0)],
                  ["Limite disponível", Number(dados.limite_credito || 0) - Number(dados.credito?.utilizado ?? 0)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo as string}>
                    <dt className="text-sm font-bold uppercase text-ink">{rotulo}</dt>
                    <dd className="tabular-nums text-ink-muted">{formatarMoeda(valor as number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-center text-sm text-ink-muted">
                Parcelas vencidas, a vencer e pagas do cliente aparecem aqui quando o Contas a receber estiver pronto. O limite é alterado no campo "Limite de Crédito" da ficha.
              </p>
            </div>
          )}

          {aba === "Histórico" && (
            <>
            {/* Anotações digitadas (lápis e lixeira, gravam no Salvar) + orçamentos e pedidos (só a lupa), do mais recente para o mais antigo. */}
            <AbaLista<LinhaHistorico>
              nova={{ data: hoje(), descricao: "", status: 1 }}
              linhas={[...dados.historico, ...documentos.map(linhaDoDocumento)].sort((a, b) => b.data.localeCompare(a.data))}
              onChange={(l) => set("historico", l.filter((x) => !x.documento).sort((a, b) => b.data.localeCompare(a.data)))}
              podeSalvar={podeSalvar}
              somenteLeitura={(h) => !!h.documento}
              chave={(h) => (h.documento ? `${h.documento.origem}-${h.documento.chave}` : `nota-${h.id}`)}
              acoes={(h) =>
                h.documento ? (
                  <Link
                    to={`${h.documento.origem === "pedido" ? ROTA_PEDIDOS : ROTA_ORCAMENTOS}/${h.documento.chave}`}
                    aria-label={`Abrir ${h.descricao}`}
                    title="Abrir"
                    className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9"
                  >
                    <IconSearch size={20} aria-hidden />
                  </Link>
                ) : null
              }
              vazio="Nenhum histórico para este cliente até o momento!"
              validar={(h) => (!h.data ? "Informe a data." : !h.descricao.trim() ? "Informe a descrição." : null)}
              campos={(h, setH) => (
                <>
                  <TextField label="Data" type="date" value={h.data} onChange={(e) => setH({ data: e.target.value })} />
                  <TextField label="Descrição" span={3} maxLength={300} value={h.descricao} onChange={(e) => setH({ descricao: e.target.value })} />
                  <SelectField
                    label="Status"
                    span={2}
                    value={h.status}
                    onChange={(e) => setH({ status: Number(e.target.value) as 1 | 2 })}
                    options={[{ value: 1, label: "Pendente" }, { value: 2, label: "Concluído" }]}
                  />
                </>
              )}
              colunas={[
                { cabecalho: "Data", exibir: (h) => formatarData(h.data), classe: "w-28 tabular-nums" },
                { cabecalho: "Descrição", exibir: (h) => h.descricao },
                {
                  cabecalho: "Status",
                  classe: "w-28",
                  exibir: (h) =>
                    h.documento ? (
                      <span className={cn("font-semibold uppercase", COR_STATUS_DOCUMENTO[h.documento.status] ?? "text-ink")}>{h.documento.status}</span>
                    ) : (
                      <span className={cn("font-semibold uppercase", h.status === 2 ? "text-success" : "text-warning-ink")}>{h.status === 2 ? "Concluído" : "Pendente"}</span>
                    ),
                },
              ]}
            />
            {editando && (
              <div className="mt-3 flex justify-end">
                {/* Como na MarketUP: o botão fica cinza quando não há mais registros. */}
                <button
                  type="button"
                  onClick={() => carregarDocumentos(paginaDocumentos + 1)}
                  disabled={documentos.length >= totalDocumentos}
                  className="min-h-12 rounded-xs bg-secondary px-4 text-xs font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted md:min-h-9"
                >
                  Ver mais registros
                </button>
              </div>
            )}
            </>
          )}
        </div>

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}

const rotuloBanco = (bancos: Banco[], id: number | null) => {
  const b = bancos.find((x) => x.id === id);
  return b ? `${b.codigo} - ${b.nome}` : "—";
};

/** Botão "+" verde da MarketUP ao lado de um select: cadastra um item novo só com o nome. */
export function NovoRapido({ rotulo, onCriar }: { rotulo: string; onCriar: (nome: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const criar = async () => {
    if (!nome.trim()) return setErro("Informe o nome.");
    try {
      await onCriar(nome.trim());
      setAberto(false);
      setNome("");
      setErro("");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cadastrar.");
    }
  };
  return (
    <div className="relative">
      <button type="button" aria-label={rotulo} title={rotulo} onClick={() => setAberto((a) => !a)} className="inline-flex size-12 items-center justify-center rounded-xs bg-primary text-primary-foreground hover:bg-primary-dark [@media(pointer:fine)]:size-[34px]">
        <IconPlus size={18} aria-hidden />
      </button>
      {aberto && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xs border border-line bg-surface-raised p-3 shadow-lg">
          <label className="mb-1 block font-label text-sm text-ink-muted" htmlFor={`novo-${rotulo}`}>{rotulo}</label>
          <div className="flex gap-1">
            <input
              id={`novo-${rotulo}`}
              autoFocus
              value={nome}
              maxLength={300}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  criar();
                } else if (e.key === "Escape") setAberto(false);
              }}
              className="h-12 flex-1 rounded-xs border border-line px-2 text-base md:h-[34px] md:text-sm"
            />
            <button type="button" onClick={criar} className="min-h-12 rounded-xs bg-secondary px-3 text-sm font-bold text-surface-raised md:min-h-[34px]">OK</button>
          </div>
          {erro && <p className="mt-1 text-xs font-semibold text-error">{erro}</p>}
        </div>
      )}
    </div>
  );
}

/** Anexo do documento: só depois de salvo (precisa do id do documento). `recurso`: clientes ou fornecedores. */
export function Anexo({ documento, clienteId, podeSalvar, onAnexo, onErro, recurso = "clientes" }: {
  documento: { id?: number; arquivo?: string | null };
  clienteId: number | null;
  recurso?: string;
  podeSalvar: boolean;
  onAnexo: (arquivo: string | null) => void;
  onErro: (mensagem: string) => void;
}) {
  const salvo = clienteId && documento.id && documento.id > 0;
  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo || !salvo) return;
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    try {
      const r = await api<DocumentoCliente>(`/${recurso}/${clienteId}/documentos/${documento.id}/arquivo`, { method: "POST", body: corpo });
      onAnexo(r.arquivo ?? null);
    } catch (e) {
      if (e instanceof ApiError) onErro(String((e.errors.arquivo as string[] | undefined)?.join(" ") ?? e.message));
    }
  };
  return (
    <>
      {documento.arquivo && (
        <a href={documento.arquivo} target="_blank" rel="noreferrer" aria-label="Abrir anexo" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9">
          <IconFileText size={18} aria-hidden />
        </a>
      )}
      {podeSalvar && salvo && (
        <label title="Enviar anexo (PDF ou imagem)" className="inline-flex size-12 cursor-pointer items-center justify-center text-primary hover:bg-primary-light md:size-9">
          <IconUpload size={18} aria-label="Enviar anexo" />
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => enviar(e.target.files?.[0])} />
        </label>
      )}
    </>
  );
}
