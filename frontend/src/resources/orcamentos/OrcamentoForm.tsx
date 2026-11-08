import { IconBarcode, IconCamera, IconCircleArrowRight, IconCircleChevronDown, IconCircleMinus, IconCirclePlus, IconCopy, IconEqual, IconList, IconMessage, IconPrinter, IconSearch, IconTrash, IconUser } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ModalAviso } from "@/components/Modal";
import { BalaoEdicao } from "@/components/BalaoEdicao";
import { CampoNumero, numeroBr } from "@/components/CampoNumero";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarCep, formatarCpf, formatarCnpj, formatarData, formatarMoeda, formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { Produto, Servico, Unidade } from "@/resources/catalogo/types";
import type { Cliente, EnderecoCliente, ListaPreco } from "@/resources/clientes/types";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";
import type { TipoPagamento } from "@/resources/financeiro/types";

import { DescontoItemModal } from "./DescontoItemModal";
import { DadosCliente } from "./DadosCliente";
import { NovoEndereco } from "./NovoEndereco";
import { ROTA_ORCAMENTOS as ROTA } from "./OrcamentosList";
import { ehFracionada, precoNaLista, unidadesDoItem, type ItemCatalogo, type UnidadeVenda } from "./preco";
import { STATUS, totaisOrcamento, totalItem, type ItemOrcamento, type Orcamento, type ParcelaOrcamento } from "./types";

type Dados = Omit<Orcamento, "id">;
type Vendedor = { id: number; nome: string };

const VAZIO: Dados = {
  status: 1, cliente: null, endereco_faturamento: null, endereco_entrega: null, vendedor: null,
  emissao: "", validade: null, entrega: null, observacao: "",
  desconto: "0.00", desconto_percentual: "0", desconto_em_percentual: false, frete: "0.00", outros_custos: "0.00",
  itens: [], parcelas: [],
};

const campoCaixa = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const iconeTopo = "inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light";
const rotuloMini = "text-[11px] font-semibold uppercase text-primary";

/** Vendas › Orçamento: ficha com as seções da MarketUP (Orçamento, Cliente, Itens, Pagamento). */
export function OrcamentoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();

  const [numero, setNumero] = useState<number | null>(null);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [lista, setLista] = useState<ListaPreco | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [cancelar, setCancelar] = useState(false);

  const aberto = dados.status === 1;
  const podeSalvar = aberto && pode(ROTA, editando ? "alterar" : "adicionar");
  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));

  // Carga inicial: listas de apoio e o orçamento (ou os valores iniciais de um novo).
  useEffect(() => {
    api<Vendedor[]>("/orcamentos/vendedores").then(setVendedores, () => undefined);
    api<Unidade[]>("/unidades").then(setUnidades, () => undefined);
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results.filter((t) => t.ativo)), () => undefined);
    Promise.all([
      api<{ results: Produto[] }>("/produtos?page_size=1000&ativo=true&ordering=descricao").catch(() => ({ results: [] as Produto[] })),
      api<{ results: Servico[] }>("/servicos?page_size=1000&ordering=nome").catch(() => ({ results: [] as Servico[] })),
    ]).then(([p, s]) =>
      setCatalogo([
        ...p.results.map((x) => ({ chave: `p${x.id}`, tipo: "produto" as const, id: x.id, codigo: x.codigo_barras, nome: x.descricao, unidade: x.unidade, sigla: x.unidade_sigla, produto: x })),
        ...s.results.filter((x) => x.ativo).map((x) => ({ chave: `s${x.id}`, tipo: "servico" as const, id: x.id, codigo: x.codigo_barras, nome: x.nome, unidade: x.unidade, sigla: x.unidade_sigla, servico: x })),
      ]),
    );
    const carregar = editando
      ? api<Orcamento>(`/orcamentos/${id}`).then(({ id: n, ...o }) => {
          setNumero(n);
          setDados({ ...VAZIO, ...o });
          return o.cliente;
        })
      : api<Partial<Dados>>("/orcamentos/novo").then((padrao) => {
          setDados({ ...VAZIO, ...padrao });
          return null;
        });
    carregar
      .then((clienteId) => (clienteId ? escolherCliente(clienteId, false) : undefined))
      .catch((e: ApiError) => setAviso(e.message))
      .finally(() => setCarregando(false));
  }, [editando, id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Carrega a ficha do cliente (endereços, crédito) e a lista de preços dele. */
  async function escolherCliente(clienteId: number, preencher = true) {
    const c = await api<Cliente>(`/clientes/${clienteId}`);
    setCliente(c);
    api<ListaPreco>(`/listas-precos/${c.lista_preco}`).then(setLista, () => setLista(null));
    if (preencher) {
      const padrao = c.enderecos.find((e) => e.padrao && e.ativo) ?? c.enderecos.find((e) => e.ativo);
      setDados((d) => ({ ...d, cliente: c.id, endereco_faturamento: padrao?.id ?? null, endereco_entrega: padrao?.id ?? null }));
    }
  }

  /**
   * "Cadastrar novo cliente" (MarketUP): cria o cliente na hora só com o nome digitado
   * (pessoa física, lista Padrão, limite para novos clientes) e já o coloca no orçamento;
   * CPF, telefone e endereço se completam ali mesmo.
   */
  async function cadastrarCliente(nome: string) {
    const novo = await api<Cliente>("/clientes", { method: "POST", body: JSON.stringify({ nome, tipo_pessoa: "F" }) });
    await escolherCliente(novo.id);
    setAviso(`Cliente ${novo.nome} cadastrado. Complete CPF, telefone e endereço abaixo.`);
  }

  const totais = useMemo(() => totaisOrcamento(dados), [dados]);
  const erro = (k: string) => {
    const e = erros[k];
    return e ? (Array.isArray(e) ? e.map((x) => (typeof x === "string" ? x : Object.values(x as object).flat().join(" "))).join(" ") : String(e)) : undefined;
  };

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    // Como na MarketUP, não salva sem cliente: leva a pessoa até o campo do nome.
    if (!dados.cliente) {
      setErros({ cliente: ["Identifique o cliente: digite o nome para localizá-lo ou use Cadastrar novo cliente."] });
      setAviso("Identifique o cliente para salvar o orçamento.");
      const campo = document.querySelector<HTMLInputElement>('input[aria-label="Buscar cliente"]');
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus({ preventScroll: true });
      return;
    }
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = {
      ...dados,
      itens: dados.itens.map(({ id: _i, subtotal: _s, total: _t, unidade_sigla: _u, codigo_barras: _c, ...i }) => i),
      parcelas: dados.parcelas.map(({ id: _i, tipo_pagamento_nome: _t, condicao_pagamento_nome: _c, ...p }) => p),
    };
    try {
      const salvo = await api<Orcamento>(editando ? `/orcamentos/${id}` : "/orcamentos", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else {
        const { id: _n, ...o } = salvo;
        setDados({ ...VAZIO, ...o });
        setAviso("Orçamento salvo.");
      }
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  // "Salvar" do balão de comentários: no orçamento já gravado, grava só os comentários na hora;
  // no orçamento novo, fica na ficha e vai junto com o Salvar.
  const salvarComentarios = async (observacao: string) => {
    set("observacao", observacao);
    if (!editando) return;
    try {
      await api(`/orcamentos/${id}`, { method: "PATCH", body: JSON.stringify({ observacao }) });
      setErros({});
      setAviso("Comentários salvos.");
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível salvar os comentários.");
    }
  };

  const copiar = async () => {
    try {
      const copia = await api<Orcamento>(`/orcamentos/${id}/copiar`, { method: "POST" });
      navigate(`${ROTA}/${copia.id}`);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível copiar.");
    }
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  const status = STATUS[dados.status];
  const enderecos = cliente?.enderecos.filter((e) => e.ativo) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Vendas"
        title="Orçamento"
        acoes={
          <>
            <Link to={ROTA} aria-label="Listar orçamentos" title="Listar" className={iconeTopo}>
              <IconList size={28} aria-hidden />
            </Link>
            {editando && (
              <Link to={`${ROTA}/${id}/imprimir`} target="_blank" aria-label="Imprimir" title="Imprimir / PDF" className={iconeTopo}>
                <IconPrinter size={28} aria-hidden />
              </Link>
            )}
            {editando && pode(ROTA, "adicionar") && (
              <button type="button" onClick={copiar} aria-label="Copiar orçamento" title="Copiar (novo orçamento igual)" className={iconeTopo}>
                <IconCopy size={28} aria-hidden />
              </button>
            )}
            {pode(ROTA, "adicionar") && (
              <Link to={`${ROTA}/novo`} reloadDocument className="ml-2 flex min-h-12 flex-col items-center justify-center bg-primary px-3 text-center text-[11px] font-bold uppercase leading-tight text-primary-foreground hover:bg-primary-dark">
                Adicionar<span className="text-base">Novo</span>
              </Link>
            )}
          </>
        }
      />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        {erro("detail") && <p role="alert" className="mb-4 rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{erro("detail")}</p>}

        {/* ---- Orçamento ---- */}
        <h2 className="mb-2 text-2xl font-normal text-ink md:text-[30px]">Orçamento</h2>
        <div className="flex flex-col border border-primary sm:flex-row">
          <div className={cn("flex min-h-24 items-center justify-center px-6 text-2xl font-bold uppercase sm:w-[268px]", status.fundo)}>{status.rotulo}</div>
          <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 p-3 sm:grid-cols-3">
            <div className="flex items-end text-4xl font-normal tabular-nums text-ink">
              <span className="mr-1 text-sm text-primary">#</span>
              {numero ?? "novo"}
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              {/* Balão "Comentários" da MarketUP: texto livre do orçamento, com um só botão Salvar. */}
              <BalaoEdicao
                titulo="Comentários"
                tituloMaiusculo
                semCancelar
                rotuloConfirmar="Salvar"
                valorInicial={dados.observacao}
                disabled={!podeSalvar}
                onConfirmar={salvarComentarios}
                gatilho={(abrir, aberto) => (
                  <button
                    type="button"
                    onClick={abrir}
                    aria-expanded={aberto}
                    aria-label="Comentários"
                    title={dados.observacao || "Comentários"}
                    className={cn("inline-flex size-12 shrink-0 items-center justify-center transition-transform hover:scale-110", dados.observacao ? "text-primary" : "text-ink-muted")}
                  >
                    <IconMessage size={30} stroke={1.5} aria-hidden />
                  </button>
                )}
              />
              <label className="flex-1">
                <span className={rotuloMini}>Vendedor</span>
                <select value={dados.vendedor ?? ""} onChange={(e) => set("vendedor", e.target.value ? Number(e.target.value) : null)} disabled={!podeSalvar} className={cn(campoCaixa, "font-semibold uppercase")}>
                  <option value="">Selecione</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  {dados.vendedor && !vendedores.some((v) => v.id === dados.vendedor) && <option value={dados.vendedor}>{dados.vendedor_nome}</option>}
                </select>
              </label>
              <IconUser size={28} aria-hidden className="mb-1 hidden text-ink-muted sm:block" />
            </div>
            {(["emissao", "validade", "entrega"] as const).map((campo) => (
              <label key={campo}>
                <span className={rotuloMini}>{{ emissao: "Emissão", validade: "Validade", entrega: "Entrega" }[campo]}</span>
                <input type="date" value={dados[campo] ?? ""} onChange={(e) => set(campo, (e.target.value || null) as never)} disabled={!podeSalvar} aria-invalid={!!erro(campo)} className={cn(campoCaixa, "text-lg tabular-nums")} />
                {erro(campo) && <span className="text-xs font-semibold text-error">{erro(campo)}</span>}
              </label>
            ))}
          </div>
        </div>
        {dados.data_cancelamento && <p className="mt-2 text-sm font-semibold text-error">Cancelado em {formatarData(dados.data_cancelamento)}.</p>}
        {dados.pedido_id && <p className="mt-2 text-sm font-semibold text-success">Pedido gerado: nº {dados.pedido_id}.</p>}

        {/* ---- Cliente ---- */}
        <h2 className="mb-2 mt-8 text-2xl font-normal text-ink md:text-[30px]">Cliente</h2>
        <BuscaCliente
          nome={cliente?.nome ?? dados.cliente_nome ?? ""}
          disabled={!podeSalvar}
          erro={erro("cliente")}
          credito={cliente?.credito ? Number(cliente.credito.disponivel) : null}
          onEscolher={(c) => escolherCliente(c).catch((e: ApiError) => setAviso(e.message))}
          onCadastrar={pode("/vendas/clientes", "adicionar") ? cadastrarCliente : undefined}
          onLimpar={() => {
            setCliente(null);
            setLista(null);
            setDados((d) => ({ ...d, cliente: null, endereco_faturamento: null, endereco_entrega: null }));
          }}
        />
        {cliente && (
          <>
            <DadosCliente cliente={cliente} podeAlterar={podeSalvar && pode("/vendas/clientes", "alterar")} onSalvo={setCliente} />
            {(["endereco_faturamento", "endereco_entrega"] as const).map((campo) => (
              <div key={campo} className="mt-5">
                <h3 className="mb-2 border-b border-line pb-1 text-sm font-semibold uppercase text-ink">{campo === "endereco_entrega" ? "Endereço de entrega" : "Endereço para faturamento"}</h3>
                {erro(campo) && <p className="mb-1 text-xs font-semibold text-error">{erro(campo)}</p>}
                <div className="flex flex-wrap gap-2">
                  {enderecos.map((e) => (
                    <CartaoEndereco key={e.id} endereco={e} escolhido={dados[campo] === e.id} disabled={!podeSalvar} onClick={() => set(campo, e.id ?? null)} />
                  ))}
                  {enderecos.length === 0 && <p className="text-sm text-ink-muted">Cliente sem endereço cadastrado.</p>}
                  {podeSalvar && pode("/vendas/clientes", "alterar") && (
                    <div className="sm:ml-auto">
                    <NovoEndereco
                      cliente={cliente}
                      abertoInicial={campo === "endereco_faturamento" && enderecos.length === 0}
                      onCriado={(atualizado, novo) => {
                        setCliente(atualizado);
                        set(campo, novo);
                      }}
                    />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ---- Itens ---- */}
        <h2 className="mb-2 mt-8 text-2xl font-normal text-ink md:text-[30px]">Itens</h2>
        {erro("itens") && <p role="alert" className="mb-2 text-sm font-semibold text-error">{erro("itens")}</p>}
        {podeSalvar && <IncluirItem catalogo={catalogo} lista={lista} onIncluir={(i) => set("itens", [...dados.itens, i])} />}
        <TabelaItens itens={dados.itens} unidades={unidades} catalogo={catalogo} lista={lista} podeSalvar={podeSalvar} onChange={(itens) => set("itens", itens)} />

        <div className="mt-2 flex flex-col items-end">
          <p className="text-[11px] uppercase text-primary">Subtotal (R$)</p>
          <Valor valor={totais.subtotal} className="text-2xl text-primary" />
          {/* Quadro de ajustes: desconto (−), frete (+), outros custos (+), como na MarketUP. */}
          <div className="mt-2 w-full max-w-[668px] border-y-4 border-primary bg-surface px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
              <span className="flex items-center justify-end gap-2 uppercase">
                Desconto
                <BotoesRP valor={dados.desconto_em_percentual} disabled={!podeSalvar} onChange={(p) => set("desconto_em_percentual", p)} />
              </span>
              <CampoValor
                valor={dados.desconto_em_percentual ? dados.desconto_percentual : dados.desconto}
                prefixo={dados.desconto_em_percentual ? "%" : "R$"}
                rotulo="Desconto"
                disabled={!podeSalvar}
                erro={erro("desconto")}
                onChange={(v) => set(dados.desconto_em_percentual ? "desconto_percentual" : "desconto", v)}
              />
              <IconCircleMinus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
              <span className="text-right uppercase">Frete</span>
              <CampoValor valor={dados.frete} prefixo="R$" rotulo="Frete" disabled={!podeSalvar} onChange={(v) => set("frete", v)} />
              <IconCirclePlus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
              <span className="text-right uppercase">Outros custos</span>
              <CampoValor valor={dados.outros_custos} prefixo="R$" rotulo="Outros custos" disabled={!podeSalvar} onChange={(v) => set("outros_custos", v)} />
              <IconCirclePlus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
              {dados.desconto_em_percentual && <span className="col-span-3 text-right text-xs text-ink-muted">Desconto de {formatarMoeda(totais.desconto)}</span>}
            </div>
          </div>
          <p className="mt-4 text-[11px] uppercase text-primary">Total final (R$)</p>
          <span className="flex items-center gap-1">
            <Valor valor={totais.total} className="text-5xl text-primary" />
            <IconEqual size={22} aria-hidden className="rounded-full border-2 border-ink text-ink" />
          </span>
        </div>

        {/* ---- Pagamento ---- */}
        <h2 className="mb-2 mt-8 text-2xl font-normal text-ink md:text-[30px]">Pagamento</h2>
        <Pagamento
          tipos={tipos}
          parcelas={dados.parcelas}
          total={totais.total}
          podeSalvar={podeSalvar}
          erro={erro("parcelas")}
          onChange={(p) => set("parcelas", p)}
        />

        <BarraAcoes
          voltar={ROTA}
          aviso={aviso}
          erro={!!Object.keys(erros).length}
          podeSalvar={podeSalvar}
          salvando={salvando}
          onSalvarEVoltar={salvar(true)}
          extras={
            editando && aberto ? (
              <>
                {pode(ROTA, "alterar") && (
                  <button type="button" onClick={() => setCancelar(true)} className="min-h-12 rounded-xs bg-error px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
                    Cancelar
                  </button>
                )}
                <button type="button" disabled title="Chega com a T203 (Pedidos)" className="min-h-12 rounded-xs bg-secondary px-4 text-sm font-bold uppercase text-surface-raised opacity-50">
                  Gerar pedido
                </button>
              </>
            ) : null
          }
        />
      </form>

      {cancelar && (
        <ConfirmDialog
          title="Cancelar orçamento"
          message={`Cancelar o orçamento ${numero}? Depois de cancelado ele não pode mais ser alterado (use Copiar para refazer).`}
          confirmLabel="Cancelar orçamento"
          onCancel={() => setCancelar(false)}
          onConfirm={async () => {
            setCancelar(false);
            try {
              const o = await api<Orcamento>(`/orcamentos/${id}/cancelar`, { method: "PATCH" });
              const { id: _n, ...resto } = o;
              setDados({ ...VAZIO, ...resto });
              setAviso("Orçamento cancelado.");
            } catch (e) {
              setAviso(e instanceof ApiError ? e.message : "Não foi possível cancelar.");
            }
          }}
        />
      )}
    </>
  );
}

function CartaoEndereco({ endereco: e, escolhido, disabled, onClick }: { endereco: EnderecoCliente; escolhido: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={escolhido}
      className={cn(
        "flex min-h-[90px] w-full flex-col items-start rounded-xs p-3 text-left text-sm sm:w-[268px]",
        escolhido ? "bg-primary text-primary-foreground" : "bg-surface text-ink hover:bg-primary-light",
      )}
    >
      <span className="font-bold tabular-nums">
        {e.exterior ? "Exterior" : formatarCep(e.cep)} <span className="font-normal opacity-80">({e.cidade}/{e.uf})</span>
      </span>
      <span>{[e.logradouro, e.numero].filter(Boolean).join(", ")}{e.bairro ? ` - ${e.bairro}` : ""}</span>
      {e.complemento && <span className="text-xs opacity-80">{e.complemento}</span>}
    </button>
  );
}

/** Busca de cliente por nome, CPF/CNPJ ou telefone (a partir da 3ª letra). */
function BuscaCliente({ nome, disabled, erro, credito, onEscolher, onLimpar, onCadastrar }: {
  nome: string;
  disabled: boolean;
  erro?: string;
  credito: number | null;
  onEscolher: (id: number) => void;
  onLimpar: () => void;
  /** Sem permissão de adicionar clientes, o botão "Cadastrar novo cliente" não aparece. */
  onCadastrar?: (nome: string) => Promise<void>;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<{ id: number; nome: string; telefone: string; cpf: string; cnpj: string }[]>([]);
  const [buscando, setBuscando] = useState(!nome);
  const [cadastrando, setCadastrando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");

  useEffect(() => {
    if (termo.trim().length < 3) return setResultados([]);
    const t = window.setTimeout(() => {
      api<{ results: typeof resultados }>(`/clientes?search=${encodeURIComponent(termo.trim())}&page_size=15&bloqueado=false`).then((r) => setResultados(r.results), () => setResultados([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [termo]);

  if (nome && !buscando) {
    return (
      <div className="flex items-center gap-4 border-b-4 border-secondary-light bg-line/70 px-4 py-3">
        <span className="flex-1 text-2xl text-ink md:text-3xl">{nome}</span>
        {credito !== null && (
          <span className="text-right">
            <span className="block text-[10px] uppercase text-ink-muted">Crédito disponível</span>
            <span className="text-lg font-semibold tabular-nums text-primary">{formatarMoeda(credito)}</span>
          </span>
        )}
        {!disabled && (
          <button type="button" onClick={() => { setBuscando(true); setTermo(""); onLimpar(); }} aria-label="Trocar cliente" title="Trocar cliente" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light">
            <IconSearch size={22} aria-hidden />
          </button>
        )}
      </div>
    );
  }
  const cadastrar = async () => {
    const novoNome = termo.trim();
    if (novoNome.length < 3) return setErroCadastro("Digite o nome do cliente (pelo menos 3 letras) e clique em Cadastrar novo cliente.");
    setCadastrando(true);
    setErroCadastro("");
    try {
      await onCadastrar!(novoNome);
      setBuscando(false);
      setResultados([]);
    } catch (e) {
      setErroCadastro(e instanceof ApiError ? e.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setCadastrando(false);
    }
  };

  return (
    <div className="relative">
      {/* Campo do nome + "Cadastrar novo cliente" à direita, como na MarketUP. */}
      <div className="flex flex-col border-b-4 border-secondary-light bg-line/70 sm:flex-row">
        <input
          aria-label="Buscar cliente"
          placeholder="Nome do cliente"
          value={termo}
          disabled={disabled}
          onChange={(e) => { setTermo(e.target.value); setErroCadastro(""); }}
          aria-invalid={!!erro}
          className="h-16 min-w-0 flex-1 bg-transparent px-4 text-2xl text-ink placeholder:text-ink-muted focus:outline-none md:text-3xl"
        />
        {onCadastrar && !disabled && (
          <button
            type="button"
            onClick={cadastrar}
            disabled={cadastrando}
            title={termo.trim() ? `Cadastrar "${termo.trim()}" como cliente novo` : "Digite o nome do cliente novo"}
            className="flex min-h-16 flex-col items-center justify-center bg-secondary px-6 text-center font-bold uppercase leading-tight text-surface-raised hover:opacity-90 disabled:opacity-60 sm:w-[280px]"
          >
            {cadastrando ? "Cadastrando…" : <>Cadastrar<span className="text-sm font-normal">novo cliente</span></>}
          </button>
        )}
      </div>
      {(erro || erroCadastro) && <p role="alert" className="mt-1 text-xs font-semibold text-error">{erroCadastro || erro}</p>}
      {!termo && !disabled && (
        <div className="mt-4 px-2 text-ink">
          <p className="text-lg font-bold">Identificando o cliente</p>
          <p className="text-sm text-ink-muted">
            Para fazer o orçamento é preciso identificar o cliente: digite o nome no campo acima para localizá-lo. Se for um cliente novo, cadastre agora em "Cadastrar novo cliente".
          </p>
        </div>
      )}
      {resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised shadow-lg">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setBuscando(false);
                  setResultados([]);
                  onEscolher(c.id);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-light"
              >
                <span>{c.nome}</span>
                <span className="text-xs tabular-nums text-ink-muted">{c.cnpj ? formatarCnpj(c.cnpj) : c.cpf ? formatarCpf(c.cpf) : formatarTelefone(c.telefone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {termo.trim().length >= 3 && resultados.length === 0 && (
        <p className="mt-1 text-xs text-ink-muted">Nenhum cliente encontrado com esse nome.{onCadastrar ? " Se for um cliente novo, use Cadastrar novo cliente." : ""}</p>
      )}
    </div>
  );
}

// Faixa de inclusão igual à da MarketUP: item, quantidade e unitário. A observação (medidas) vai depois, no balão do item.
const ITEM_NOVO = { quantidade: "1", valor_unitario: "0.00", unidade: null as number | null };

/** Faixa azul "Digite o nome ou código do item · Qntd. (unidade ⓥ) · Unitário · Total · Incluir no pedido". */
function IncluirItem({ catalogo, lista, onIncluir }: { catalogo: ItemCatalogo[]; lista: ListaPreco | null; onIncluir: (i: ItemOrcamento) => void }) {
  const [termo, setTermo] = useState("");
  const [escolhido, setEscolhido] = useState<ItemCatalogo | null>(null);
  const [linha, setLinha] = useState(ITEM_NOVO);
  const [erro, setErro] = useState("");

  const encontrados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t || escolhido) return [];
    return catalogo.filter((c) => c.nome.toLowerCase().includes(t) || c.codigo.includes(t)).slice(0, 20);
  }, [termo, catalogo, escolhido]);
  const unidades = escolhido ? unidadesDoItem(escolhido) : [];

  // Como na MarketUP: ao escolher o item, quantidade 1 na unidade do produto e preço de varejo.
  const escolher = (c: ItemCatalogo) => {
    setEscolhido(c);
    setTermo(c.nome);
    setErro("");
    setLinha({ quantidade: "1", unidade: c.unidade, valor_unitario: precoNaLista(c, 1, lista, c.unidade) });
  };
  const mudarQuantidade = (q: string) =>
    setLinha((l) => ({ ...l, quantidade: q, valor_unitario: escolhido ? precoNaLista(escolhido, Number(q || 0), lista, l.unidade) : l.valor_unitario }));
  // Trocar para a unidade da fração usa o valor da fração; voltar usa o varejo/atacado.
  const mudarUnidade = (unidade: number) =>
    setLinha((l) => ({ ...l, unidade, valor_unitario: escolhido ? precoNaLista(escolhido, Number(l.quantidade || 0), lista, unidade) : l.valor_unitario }));
  const passo = (delta: number) => mudarQuantidade(String(Math.max(0, Number(linha.quantidade || 0) + delta)));

  const incluir = () => {
    if (!escolhido) return setErro("Escolha o item na lista.");
    if (!(Number(linha.quantidade) > 0)) return setErro("Informe a quantidade.");
    onIncluir({
      produto: escolhido.tipo === "produto" ? escolhido.id : null,
      servico: escolhido.tipo === "servico" ? escolhido.id : null,
      descricao: escolhido.nome,
      codigo_barras: escolhido.codigo,
      unidade: linha.unidade,
      unidade_sigla: unidades.find((u) => u.id === linha.unidade)?.sigla ?? escolhido.sigla,
      quantidade: linha.quantidade,
      valor_unitario: linha.valor_unitario,
      desconto: "0.00",
      desconto_percentual: "0",
      desconto_em_percentual: false,
      fragmentado: ehFracionada(escolhido, linha.unidade),
      observacao: "",
    });
    setEscolhido(null);
    setTermo("");
    setLinha(ITEM_NOVO);
  };
  const total = totalItem({ ...linha, desconto: "0", desconto_percentual: "0", desconto_em_percentual: false }).total;

  return (
    <div className="relative">
      <div className="flex flex-col text-primary-foreground md:flex-row">
        <div className="relative flex-1 bg-primary/75">
          <input
            aria-label="Item"
            placeholder="DIGITE O NOME OU CÓDIGO DO ITEM"
            value={termo}
            onChange={(e) => { setTermo(e.target.value); setEscolhido(null); }}
            className="h-16 w-full bg-transparent px-3 text-lg text-primary-foreground placeholder:text-primary-foreground/90 focus:outline-none md:h-[90px]"
          />
        </div>
        <div className="flex items-center gap-2 bg-primary/85 px-3">
          <div className="flex flex-col items-center">
            {escolhido ? (
              <CampoNumero aria-label="Quantidade" casas={3} value={linha.quantidade} onChange={mudarQuantidade} className="h-10 w-24 bg-transparent text-center text-2xl tabular-nums text-primary-foreground focus:outline-none" />
            ) : (
              <span className="text-2xl uppercase">Qntd.</span>
            )}
            {/* Seta da unidade (MarketUP): escolhe entre a unidade do produto e a da fração. */}
            <SeletorUnidade unidades={unidades} valor={linha.unidade} onChange={mudarUnidade} />
          </div>
          <div className="flex flex-col">
            <button type="button" onClick={() => passo(1)} aria-label="Aumentar quantidade" className="inline-flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110">
              <IconCirclePlus size={30} stroke={1.5} aria-hidden />
            </button>
            <button type="button" onClick={() => passo(-1)} aria-label="Diminuir quantidade" className="inline-flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110">
              <IconCircleMinus size={30} stroke={1.5} aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-primary px-4">
          <label className="flex flex-col text-[10px] uppercase">
            Unitário (R$)
            <CampoNumero aria-label="Unitário" value={linha.valor_unitario} onChange={(v) => setLinha((l) => ({ ...l, valor_unitario: v }))} className="h-10 w-28 bg-transparent text-right text-2xl tabular-nums text-primary-foreground focus:outline-none" />
          </label>
          <span className="flex flex-col text-right text-[10px] uppercase">
            Total (R$)
            <span className="text-2xl tabular-nums">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </span>
        </div>
        <button type="button" onClick={incluir} className="min-h-16 bg-primary-dark px-6 text-center font-bold uppercase leading-tight hover:brightness-110">
          Incluir<br /><span className="text-xs font-normal">no pedido</span>
        </button>
      </div>
      {erro && <p role="alert" className="mt-1 text-xs font-semibold text-error">{erro}</p>}
      {encontrados.length > 0 && (
        <ul className="absolute left-0 top-16 z-20 max-h-72 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised text-ink shadow-lg md:top-[90px] md:w-1/2">
          {encontrados.map((c) => (
            <li key={c.chave}>
              <button type="button" onClick={() => escolher(c)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-light">
                <span>
                  <span className="block text-[11px] tabular-nums text-ink-muted">{c.codigo || "sem código"} · {c.tipo === "produto" ? "Produto" : "Serviço"}</span>
                  {c.nome}
                </span>
                <span className="tabular-nums">{formatarMoeda(precoNaLista(c, 1, lista))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabelaItens({ itens, unidades, catalogo, lista, podeSalvar, onChange }: {
  itens: ItemOrcamento[];
  unidades: Unidade[];
  catalogo: ItemCatalogo[];
  lista: ListaPreco | null;
  podeSalvar: boolean;
  onChange: (i: ItemOrcamento[]) => void;
}) {
  const [editando, setEditando] = useState<number | null>(null);
  const mudar = (n: number, parcial: Partial<ItemOrcamento>) => onChange(itens.map((x, i) => (i === n ? { ...x, ...parcial } : x)));
  const abrir = (n: number) => podeSalvar && setEditando(n);

  if (itens.length === 0) return <p className="py-6 text-center text-sm font-semibold uppercase text-ink-muted">Nenhum item incluído.</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase text-ink">
            <th className="px-2 py-2 font-semibold">Produto/Serviço</th>
            <th className="w-36 px-2 py-2 text-right font-semibold">Quantidade</th>
            <th className="w-28 px-2 py-2 text-right font-semibold">Unitário (R$)</th>
            <th className="w-28 px-2 py-2 text-right font-semibold">Total (R$)</th>
            <th className="w-28"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, n) => {
            const t = totalItem(item);
            return (
              <tr key={n} className="border-b border-line">
                <td className="px-2 py-3">
                  <span className="flex items-center gap-3">
                    {/* Círculo da foto do item, como na MarketUP (foto real entra quando o catálogo tiver imagens). */}
                    <span aria-hidden className="hidden size-12 shrink-0 items-center justify-center rounded-full border border-secondary-light text-secondary-light sm:flex">
                      <IconCamera size={22} stroke={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[11px] tabular-nums text-ink-muted">
                        <IconBarcode size={14} aria-hidden />
                        {item.codigo_barras || "sem código"}
                      </span>
                      <span className="text-base">{item.descricao}</span>
                      {item.observacao && <span className="block text-xs text-ink-muted">{item.observacao}</span>}
                    </span>
                    {/* Balão verde da observação (medidas), ao lado da descrição. */}
                    <BalaoEdicao
                      titulo="Observação"
                      maxLength={300}
                      valorInicial={item.observacao}
                      disabled={!podeSalvar}
                      onConfirmar={(observacao) => mudar(n, { observacao })}
                      gatilho={(abrirBalao, aberto) => (
                        <button
                          type="button"
                          onClick={abrirBalao}
                          aria-expanded={aberto}
                          aria-label={`Observação de ${item.descricao}`}
                          title={item.observacao || "Observação (medidas)"}
                          className={cn("inline-flex size-12 shrink-0 items-center justify-center transition-transform hover:scale-110", item.observacao ? "text-primary" : "text-ink-muted")}
                        >
                          <IconMessage size={30} stroke={1.5} aria-hidden />
                        </button>
                      )}
                    />
                  </span>
                </td>
                <td className="whitespace-nowrap bg-surface px-2 py-3 text-right text-xl font-bold tabular-nums text-ink">
                  <button type="button" onClick={() => abrir(n)} disabled={!podeSalvar} className="enabled:hover:text-primary" aria-label={`Alterar quantidade de ${item.descricao}`}>
                    {numeroBr(item.quantidade, 3)} <span className="text-xs font-normal">{item.unidade_sigla}</span>
                  </button>
                </td>
                <td className="px-2 py-3 text-right text-xl tabular-nums text-ink">
                  <button type="button" onClick={() => abrir(n)} disabled={!podeSalvar} className="enabled:hover:text-primary" aria-label={`Alterar unitário de ${item.descricao}`}>
                    {numeroBr(item.valor_unitario)}
                  </button>
                </td>
                <td className="px-2 py-3 text-right text-xl tabular-nums text-ink">
                  {numeroBr(t.total)}
                  {t.desconto > 0 && <span className="block text-xs text-ink-muted">− {formatarMoeda(t.desconto)}</span>}
                </td>
                <td className="whitespace-nowrap bg-surface px-1 py-2 text-center">
                  {podeSalvar && (
                    <>
                      <button
                        type="button"
                        onClick={() => abrir(n)}
                        aria-label={`Desconto no item ${item.descricao}`}
                        title="Desconto no item"
                        className={cn(
                          "inline-flex size-10 items-center justify-center rounded-full text-sm font-bold transition-transform hover:scale-110",
                          t.desconto > 0 ? "bg-primary text-primary-foreground" : "bg-secondary-light text-ink",
                        )}
                      >
                        %
                      </button>
                      <button type="button" onClick={() => onChange(itens.filter((_, i) => i !== n))} aria-label={`Remover ${item.descricao}`} className="inline-flex size-10 items-center justify-center text-ink-muted transition-transform hover:scale-110 hover:text-error">
                        <IconTrash size={26} aria-hidden />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editando !== null && itens[editando] && (
        <DescontoItemModal
          item={itens[editando]}
          unidades={unidades}
          lista={lista}
          catalogo={catalogo.find((c) => (itens[editando].produto ? c.chave === `p${itens[editando].produto}` : c.chave === `s${itens[editando].servico}`))}
          onFechar={() => setEditando(null)}
          onSalvar={(item) => {
            mudar(editando, item);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function BotoesRP({ valor, onChange, disabled }: { valor: boolean; onChange: (percentual: boolean) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex" role="group" aria-label="Desconto em R$ ou %">
      {[false, true].map((p) => (
        <button
          key={String(p)}
          type="button"
          disabled={disabled}
          aria-pressed={valor === p}
          onClick={() => onChange(p)}
          className={cn("h-10 w-12 border text-sm font-semibold md:h-[34px]", valor === p ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface-raised text-ink")}
        >
          {p ? "%" : "R$"}
        </button>
      ))}
    </span>
  );
}

/** Campo "R$ 0,05" / "10,00%" do quadro de ajustes e do desconto do item. */
function CampoValor({ valor, prefixo, rotulo, onChange, disabled, erro }: { valor: string; prefixo: string; rotulo: string; onChange: (v: string) => void; disabled?: boolean; erro?: string }) {
  return (
    <span className="flex flex-col items-end">
      <CampoNumero
        aria-label={rotulo}
        value={valor}
        prefixo={prefixo === "%" ? "% " : "R$ "}
        disabled={disabled}
        onChange={onChange}
        aria-invalid={!!erro}
        className="h-10 w-36 rounded-xs border border-line bg-line/60 px-3 text-right text-base tabular-nums text-ink focus:border-brand-cyan focus:bg-surface-raised focus:outline-none aria-[invalid=true]:border-error md:h-[34px]"
      />
      {erro && <span className="text-xs font-semibold text-error">{erro}</span>}
    </span>
  );
}

/** Valor em reais com os centavos menores ("620 ,05"), como os totais da MarketUP. */
function Valor({ valor, className }: { valor: number; className?: string }) {
  const [inteiro, centavos] = numeroBr(valor).split(",");
  return (
    <span className={cn("tabular-nums", className)} aria-label={formatarMoeda(valor)}>
      {inteiro}
      <span className="ml-1 text-[0.5em]">,{centavos}</span>
    </span>
  );
}

/**
 * Pagamento no modelo da MarketUP (regras lidas do `setPayment`, `calcPaymentBalance` e `removePayment` dela):
 * - "Total a pagar" é o saldo: total do orçamento menos as parcelas já geradas.
 * - Forma + Parcelamento + Valor (já vem com o saldo) → "Gerar contas" cria um grupo de parcelas;
 *   valor acima do saldo ou zero é recusado. Depois, forma e parcelamento voltam ao vazio.
 * - Cada grupo aparece com o título "FORMA (parcelamento)"; em cada parcela dá para mudar
 *   vencimento, observação e valor. Valor que passa do total é cortado no excesso, com aviso.
 * - A lixeira do grupo remove todas as parcelas dele.
 */
function Pagamento({ tipos, parcelas, total, podeSalvar, erro, onChange }: {
  tipos: TipoPagamento[];
  parcelas: ParcelaOrcamento[];
  total: number;
  podeSalvar: boolean;
  erro?: string;
  onChange: (p: ParcelaOrcamento[]) => void;
}) {
  const [tipo, setTipo] = useState<number | "">("");
  const [condicao, setCondicao] = useState<number | "">("");
  const [valor, setValor] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  // Avisos da MarketUP ("excede o valor a receber", "ultrapassou do valor total"): modal "Aviso" com OK.
  const [mensagem, setMensagem] = useState("");
  const avisar = (m: string) => setMensagem(m);
  // Parcela com valor zero ou negativo é inválida (MarketUP: "Campo com valor inválido") e trava o "Gerar contas".
  const invalida = (p: ParcelaOrcamento) => !(Number(p.valor) > 0);
  const focarParcela = (indice: number) =>
    document.querySelector<HTMLInputElement>(`[data-parcela="${indice}"]`)?.focus();
  const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  const pago = arred(parcelas.reduce((s, p) => s + Number(p.valor || 0), 0));
  const saldo = arred(total - pago);
  const condicoes = tipos.find((t) => t.id === tipo)?.condicoes.filter((c) => c.vendas) ?? [];

  // Grupos de parcelas (um por "Gerar contas"), na ordem em que foram gerados.
  const grupos: { chave: string; titulo: string; itens: { parcela: ParcelaOrcamento; indice: number }[] }[] = [];
  parcelas.forEach((parcela, indice) => {
    const chave = parcela.grupo || `${parcela.tipo_pagamento}-${parcela.condicao_pagamento}-${parcela.quantidade}`;
    let grupo = grupos.find((g) => g.chave === chave);
    if (!grupo) {
      const condicaoNome = parcela.condicao_pagamento_nome ? `  (${parcela.condicao_pagamento_nome})` : "";
      grupo = { chave, titulo: `${parcela.tipo_pagamento_nome ?? ""}${condicaoNome}`, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push({ parcela, indice });
  });

  const gerar = async () => {
    const primeiraInvalida = parcelas.findIndex(invalida);
    if (primeiraInvalida >= 0) return focarParcela(primeiraInvalida);
    const quanto = arred(Number(valor ?? saldo));
    if (quanto > saldo) return avisar("O valor do recebimento excede o valor a receber.");
    if (!(quanto > 0)) return avisar("O valor do recebimento não pode ser 0.");
    setGerando(true);
    try {
      const novas = await api<ParcelaOrcamento[]>(`/orcamentos/gerar-parcelas?condicao=${condicao}&valor=${quanto}`);
      onChange([...parcelas, ...novas]);
      setMensagem("");
      // Como na MarketUP: forma e parcelamento voltam ao vazio e o Valor passa a ser o novo saldo.
      setTipo("");
      setCondicao("");
      setValor(null);
    } catch (e) {
      avisar(e instanceof ApiError ? e.message : "Não foi possível gerar as contas.");
    } finally {
      setGerando(false);
    }
  };

  // Qualquer mudança nas parcelas: o Valor volta a ser o saldo e forma/parcelamento voltam ao vazio (MarketUP).
  const recomecar = () => {
    setValor(null);
    setTipo("");
    setCondicao("");
  };
  const mudarParcela = (indice: number, parcial: Partial<ParcelaOrcamento>) => {
    recomecar();
    onChange(parcelas.map((p, i) => (i === indice ? { ...p, ...parcial } : p)));
  };
  // Ao sair do valor da parcela: se a soma passou do total, a parcela editada é cortada no excesso.
  const conferirExcesso = (indice: number) => {
    const excesso = arred(parcelas.reduce((s, p) => s + Number(p.valor || 0), 0) - total);
    if (excesso <= 0) return;
    onChange(parcelas.map((p, i) => (i === indice ? { ...p, valor: Math.max(0, arred(Number(p.valor) - excesso)).toFixed(2) } : p)));
    avisar("O valor digitado ultrapassou do valor total do pedido.");
  };
  const removerGrupo = (indices: number[]) => {
    onChange(parcelas.filter((_, i) => !indices.includes(i)));
    recomecar();
  };

  return (
    <div className="flex flex-col md:flex-row">
      {podeSalvar && (
        <div className="flex flex-col text-surface-raised md:w-[270px]">
          <div className="bg-secondary/85 px-4 py-3 text-right">
            <p className="text-[11px] uppercase">Total a pagar (R$)</p>
            <Valor valor={saldo} className="text-2xl font-bold" />
          </div>
          <div className="flex flex-col gap-3 bg-secondary p-4">
            <label className="text-right text-[11px] uppercase">
              Forma de pagamento
              <select value={tipo} onChange={(e) => { setTipo(e.target.value ? Number(e.target.value) : ""); setCondicao(""); }} className={cn(campoCaixa, "mt-1 text-ink")}>
                <option value="" />
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
              </select>
            </label>
            <label className="text-right text-[11px] uppercase">
              Parcelamento
              <select value={condicao} onChange={(e) => setCondicao(e.target.value ? Number(e.target.value) : "")} disabled={!tipo} className={cn(campoCaixa, "mt-1 text-ink")}>
                <option value="" />
                {condicoes.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
              </select>
            </label>
            <label className="text-right text-[11px] uppercase">
              Valor
              <CampoNumero value={valor ?? saldo} prefixo="R$ " onChange={setValor} className={cn(campoCaixa, "mt-1 text-right text-ink")} />
            </label>
          </div>
          <button type="button" onClick={gerar} disabled={!condicao || gerando} className="flex min-h-16 items-center justify-end gap-3 bg-secondary/85 px-4 text-lg font-bold uppercase disabled:opacity-60">
            {gerando ? "Gerando…" : "Gerar contas"} <IconCircleArrowRight size={32} stroke={1.5} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex-1 bg-surface">
        {erro && <p role="alert" className="mx-4 mt-3 text-sm font-semibold text-error">{erro}</p>}
        {mensagem && <ModalAviso mensagem={mensagem} onFechar={() => setMensagem("")} />}
        {parcelas.length === 0 ? (
          <div className="p-4">
            <p className="mt-10 text-2xl font-bold">Formas e Condições de Pagamento</p>
            <p className="text-ink-muted">Para finalizar seu orçamento basta escolher a forma e a condição de pagamento e clicar em GERAR CONTAS.</p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[3rem_10rem_1fr_9rem_3rem] items-center gap-3 bg-line px-4 py-3 text-xs font-semibold uppercase text-ink sm:grid">
              <span />
              <span className="text-center">Vencimento</span>
              <span>Observações</span>
              <span className="text-right">Valor (R$)</span>
              <span />
            </div>
            {grupos.map((g) => (
              <section key={g.chave} className="px-4 py-3" aria-label={g.titulo}>
                <h3 className="mb-2 text-sm font-bold text-ink">{g.titulo}</h3>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    {g.itens.map(({ parcela, indice }) => (
                      <div key={indice} className="grid grid-cols-[3rem_1fr] items-center gap-3 sm:grid-cols-[3rem_10rem_1fr_9rem]">
                        <span className="text-xs text-primary">[{parcela.numero}/{parcela.quantidade}]</span>
                        <input
                          type="date"
                          aria-label={`Vencimento da parcela ${parcela.numero}`}
                          value={parcela.vencimento}
                          disabled={!podeSalvar}
                          onChange={(e) => e.target.value && mudarParcela(indice, { vencimento: e.target.value })}
                          className={cn(campoCaixa, "bg-line/60 tabular-nums")}
                        />
                        <input
                          aria-label={`Observações da parcela ${parcela.numero}`}
                          value={parcela.descricao}
                          maxLength={300}
                          disabled={!podeSalvar}
                          onChange={(e) => mudarParcela(indice, { descricao: e.target.value })}
                          className={cn(campoCaixa, "col-span-2 sm:col-span-1")}
                        />
                        <span className="col-span-2 sm:col-span-1">
                          <CampoNumero
                            aria-label={`Valor da parcela ${parcela.numero}`}
                            data-parcela={indice}
                            prefixo="R$ "
                            value={parcela.valor}
                            disabled={!podeSalvar}
                            aria-invalid={invalida(parcela)}
                            onChange={(v) => mudarParcela(indice, { valor: v })}
                            onBlur={() => conferirExcesso(indice)}
                            className={cn(campoCaixa, "bg-line/60 text-right tabular-nums aria-[invalid=true]:border-error aria-[invalid=true]:bg-error-soft")}
                          />
                          {invalida(parcela) && <span className="mt-0.5 block text-right text-xs font-semibold text-error">Campo com valor inválido</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  {podeSalvar && (
                    <div className="flex w-12 items-center justify-center border-l border-secondary-light">
                      <button
                        type="button"
                        onClick={() => removerGrupo(g.itens.map((x) => x.indice))}
                        aria-label={`Remover o pagamento ${g.titulo}`}
                        title="Remover este pagamento"
                        className="inline-flex size-12 items-center justify-center text-ink-muted transition-transform hover:scale-110 hover:text-error"
                      >
                        <IconTrash size={30} stroke={1.5} aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Seta embaixo de "QNTD." (MarketUP): mostra a sigla da unidade e abre a lista de unidades
 * de venda do item — a do produto e, se ele é fracionado, a da fração (ex.: RL ⓥ → M).
 * É um <select> nativo transparente por cima da sigla e do ícone (teclado e celular funcionam).
 */
function SeletorUnidade({ unidades, valor, onChange }: { unidades: UnidadeVenda[]; valor: number | null; onChange: (unidade: number) => void }) {
  const atual = unidades.find((u) => u.id === valor);
  const varias = unidades.length > 1;
  return (
    <span className="relative inline-flex min-h-8 items-center gap-1 text-xs">
      {atual && <span className="font-semibold">{atual.sigla}</span>}
      {atual?.fracionada && <span className="rounded-xs bg-primary-foreground/20 px-1 text-[10px] uppercase">fração</span>}
      <IconCircleChevronDown size={18} stroke={1.5} aria-hidden className={cn(varias ? "opacity-100" : "opacity-60")} />
      <select
        aria-label={varias ? "Unidade de venda (inteira ou fracionada)" : "Unidade de venda"}
        title={varias ? "Vender na unidade do produto ou fracionado" : "Este item não é vendido fracionado"}
        value={valor ?? ""}
        disabled={unidades.length === 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {u.sigla}{u.fracionada ? " (fração)" : ""}
          </option>
        ))}
      </select>
    </span>
  );
}
