import { IconCalendar, IconCircleMinus, IconCirclePlus, IconCopy, IconEqual, IconInfoCircle, IconList, IconMail, IconMessage, IconPencil, IconPrinter, IconSearch, IconUser } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { BalaoEdicao } from "@/components/BalaoEdicao";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { botaoCancelar, botaoConfirmar, Modal, ModalAviso } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarCep, formatarCnpj, formatarCpf, formatarData, formatarMoeda, formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { Produto, Servico, Unidade } from "@/resources/catalogo/types";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";
import type { ContaGerencial, TipoPagamento } from "@/resources/financeiro/types";
import type { Empresa } from "@/resources/orcamentos/impressao";
import { BotoesRP, CampoValor, campoCaixa, iconeTopo, IncluirItem, Pagamento, rotuloMini, TabelaItens, Valor } from "@/resources/orcamentos/OrcamentoForm";
import type { ItemCatalogo } from "@/resources/orcamentos/preco";
import { totaisOrcamento, type ItemOrcamento, type ParcelaOrcamento } from "@/resources/orcamentos/types";
import { SITUACAO } from "@/resources/pedidos/types";

import { CancelarCompraModal, DevolucaoCompraModal, ReceberCompraModal } from "./ModaisCompra";
import { CAMPOS_ENDERECO, ROTA_PEDIDOS_COMPRA as ROTA, type ItemCompra, type ParcelaCompra, type PedidoCompra } from "./pedidos";
import { ROTA_FORNECEDORES } from "./types";

type Dados = Omit<PedidoCompra, "id">;
type Comprador = { id: number; nome: string };
type FornecedorBusca = { id: number; nome: string; apelido: string; cnpj: string; cpf: string; telefone: string; email: string; inscricao_estadual: string };
type Prefixo = "fat" | "ent";
type EnderecoTexto = Record<(typeof CAMPOS_ENDERECO)[number], string>;

const VAZIO = {
  status: 1, fornecedor: null, comprador: null, emissao: "", previsao: null, observacao: "",
  sem_endereco_faturamento: false, sem_endereco_entrega: false,
  desconto: "0.00", desconto_percentual: "0", desconto_em_percentual: false, frete: "0.00", outros_custos: "0.00",
  conta_gerencial: null, nota_numero: "", nota_serie: "", nota_emissao: null, itens: [], parcelas: [],
  ...Object.fromEntries(CAMPOS_ENDERECO.flatMap((c) => [[`fat_${c}`, ""], [`ent_${c}`, ""]])),
} as unknown as Dados;

const doc = (d?: string | null) => (!d ? "" : d.length === 14 ? formatarCnpj(d) : d.length === 11 ? formatarCpf(d) : d);
/** Compra: o unitário sugerido é o custo do produto. */
const custo = (c: ItemCatalogo) => Number(c.produto?.preco_custo ?? c.servico?.preco_custo ?? 0).toFixed(2);
const endereco = (d: Dados, p: Prefixo): EnderecoTexto =>
  Object.fromEntries(CAMPOS_ENDERECO.map((c) => [c, (d as unknown as Record<string, string>)[`${p}_${c}`] ?? ""])) as EnderecoTexto;
const comPrefixo = (p: Prefixo, e: Partial<EnderecoTexto>) => Object.fromEntries(Object.entries(e).map(([c, v]) => [`${p}_${c}`, v ?? ""])) as Partial<Dados>;
const mesmoEndereco = (a: Partial<EnderecoTexto>, b: Partial<EnderecoTexto>) => (a.cep ?? "") === (b.cep ?? "") && (a.logradouro ?? "") === (b.logradouro ?? "") && (a.numero ?? "") === (b.numero ?? "");

/** "Identificando o fornecedor", "Endereço de Faturamento / Cobrança", "Adicionando itens para compra": textos-guia da MarketUP. */
function Guia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-6 px-2 sm:pl-[30%]">
      <p className="text-xl font-bold text-ink">{titulo}</p>
      <div className="text-ink">{children}</div>
    </div>
  );
}

/**
 * Estoque › Compras › Pedido (purchase_order da MarketUP), no mesmo desenho da ficha dela: topo com listar, imprimir, e-mail e copiar;
 * faixa do pedido (status, nº, comentários, comprador, emissão, recebimento, CONCLUIR/RECEBER ou RECEBER/DEVOLVER); fornecedor;
 * endereços da empresa (cartões para escolher; depois de concluído, faixa larga com "Etiqueta"); itens com a coluna "Entrega";
 * ajustes; pagamento (conta gerencial no painel) e, concluído, as parcelas com "Valor pendente de pagamento" e PAGAR.
 */
export function PedidoCompraForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [numero, setNumero] = useState<number | null>(null);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [contas, setContas] = useState<ContaGerencial[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [aviso, setAviso] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<
    | null
    | { tipo: "receber" }
    | { tipo: "devolver" }
    | { tipo: "cancelar" }
    | { tipo: "cancelarComValor"; pago: number; itens: number }
    | { tipo: "custos"; n: number; itens: { descricao: string; de: string; para: string }[] }
  >(null);

  const aberto = dados.status === 1;
  const faturado = dados.status === 2 || dados.status === 6;
  const cancelado = dados.status === 7;
  const podeSalvar = aberto && pode(ROTA, editando ? "alterar" : "adicionar");
  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    api<Comprador[]>("/pedidos-compra/compradores").then(setCompradores, () => undefined);
    api<Unidade[]>("/unidades").then(setUnidades, () => undefined);
    api<Empresa>("/empresa").then(setEmpresa, () => undefined);
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results.filter((t) => t.ativo)), () => undefined);
    api<{ results: ContaGerencial[] } | ContaGerencial[]>("/contas-gerenciais?page_size=500").then(
      (r) => setContas((Array.isArray(r) ? r : r.results).filter((c) => c.tipo === "S").sort((a, b) => a.nome.localeCompare(b.nome))),
      () => undefined,
    );
    Promise.all([
      api<{ results: Produto[] }>("/produtos?page_size=1000&ativo=true&ordering=descricao").catch(() => ({ results: [] as Produto[] })),
      api<{ results: Servico[] }>("/servicos?page_size=1000&ordering=nome").catch(() => ({ results: [] as Servico[] })),
    ]).then(([p, s]) =>
      setCatalogo([
        ...p.results.map((x) => ({ chave: `p${x.id}`, tipo: "produto" as const, id: x.id, codigo: x.codigo_barras, nome: x.descricao, unidade: x.unidade, sigla: x.unidade_sigla, produto: x })),
        ...s.results.filter((x) => x.ativo).map((x) => ({ chave: `s${x.id}`, tipo: "servico" as const, id: x.id, codigo: x.codigo_barras, nome: x.nome, unidade: x.unidade, sigla: x.unidade_sigla, servico: x })),
      ]),
    );
    // Pedido novo como na MarketUP: endereços e conta gerencial começam vazios (escolhe-se nos cartões e no painel de pagamento).
    const carregar = editando
      ? recarregar()
      : api<Partial<Dados>>("/pedidos-compra/novo").then((padrao) => setDados({ ...VAZIO, emissao: padrao.emissao ?? "", previsao: padrao.previsao ?? null, comprador: padrao.comprador ?? null }));
    carregar.catch((e: ApiError) => setAviso(e.message)).finally(() => setCarregando(false));
  }, [editando, id]); // eslint-disable-line react-hooks/exhaustive-deps

  function recarregar() {
    return api<PedidoCompra>(`/pedidos-compra/${id}`).then(({ id: n, ...o }) => {
      setNumero(n);
      setDados({ ...VAZIO, ...o });
    });
  }

  const totais = useMemo(() => totaisOrcamento(dados as never), [dados]);
  const erro = (k: string) => {
    const e = erros[k];
    return e ? (Array.isArray(e) ? e.map((x) => (typeof x === "string" ? x : Object.values(x as object).flat().join(" "))).join(" ") : String(e)) : undefined;
  };
  const textoErro = (e: ApiError) => (e.message === "Confira os campos destacados." ? Object.values(e.errors).flat().map(String).join(" ") : e.message);

  const gravar = async (): Promise<number | null> => {
    if (!dados.fornecedor) {
      setErros({ fornecedor: ["Informe o fornecedor: digite o nome para localizá-lo ou use Cadastrar novo fornecedor."] });
      setAviso("Informe o fornecedor para salvar o pedido.");
      document.querySelector<HTMLInputElement>('input[aria-label="Buscar fornecedor"]')?.focus();
      return null;
    }
    if (dados.itens.length === 0) {
      setAviso("Inclua pelo menos um item no pedido.");
      return null;
    }
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = {
      ...dados,
      itens: dados.itens.map((i) => {
        const { id: _i, subtotal: _s, total: _t, unidade_sigla: _u, codigo_barras: _c, recebido: _r, devolvido: _d, data_devolucao: _dd, valor_devolvido: _vd, custo_atual: _ca, movimenta_estoque: _me, ...resto } = i;
        return resto;
      }),
      parcelas: dados.parcelas.map((p) => {
        const { id: _i, tipo_pagamento_nome: _t, condicao_pagamento_nome: _c, conta_gerencial_nome: _g, saldo: _s, conta_pagar: _p, ultimo_pagamento: _u, ...resto } = p;
        return resto;
      }),
    };
    try {
      const salvo = await api<PedidoCompra>(editando ? `/pedidos-compra/${id}` : "/pedidos-compra", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      const { id: n, ...o } = salvo;
      setDados({ ...VAZIO, ...o });
      return n;
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(textoErro(falha));
      }
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    const n = await gravar();
    if (n === null) return;
    setMensagem(`Pedido Nº ${n} salvo com sucesso!`);
    if (voltar) navigate(ROTA);
    else if (!editando) navigate(`${ROTA}/${n}`, { replace: true });
  };

  const acao = async (caminho: string, corpo: object, sucesso: (n: number) => string) => {
    setAviso("");
    try {
      const p = await api<PedidoCompra>(`/pedidos-compra/${caminho}`, { method: "POST", body: JSON.stringify(corpo) });
      const { id: n, ...o } = p;
      setDados({ ...VAZIO, ...o });
      setErros({});
      setMensagem(sucesso(n));
      return true;
    } catch (e) {
      setMensagem(e instanceof ApiError ? textoErro(e) : "Não foi possível concluir a operação.");
      return false;
    }
  };

  /** Concluir (billCurrentOrder): grava, pergunta se atualiza o custo dos itens com valor diferente e fatura. */
  const concluir = async () => {
    const n = await gravar();
    if (n === null) return;
    const custos = await api<{ descricao: string; de: string; para: string }[]>(`/pedidos-compra/${n}/custos`).catch(() => []);
    if (custos.length) return setModal({ tipo: "custos", n, itens: custos });
    await faturar(n, false);
  };
  const faturar = async (n: number, atualizar: boolean) => {
    setModal(null);
    const ok = await acao(`${n}/concluir`, { atualizar_custo: atualizar }, (x) => `Pedido Nº ${x} concluído com sucesso!`);
    if (!editando) navigate(`${ROTA}/${n}`, { replace: true });
    else if (!ok) await recarregar();
  };

  /** Cancelar: novo e não gravado só volta; sem nada pago nem recebido, confirma; senão abre o modal de cancelamento. */
  const pedirCancelamento = async () => {
    if (!editando) return navigate(ROTA);
    try {
      const previa = await api<{ valor_pago: string; itens_recebidos: number }>(`/pedidos-compra/${id}/cancelamento`);
      const pago = Number(previa.valor_pago);
      if (pago > 0 || previa.itens_recebidos > 0) setModal({ tipo: "cancelarComValor", pago, itens: previa.itens_recebidos });
      else setModal({ tipo: "cancelar" });
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível cancelar.");
    }
  };

  const salvarComentarios = async (observacao: string) => {
    set("observacao", observacao);
    if (!editando) return;
    try {
      await api(`/pedidos-compra/${id}`, { method: "PATCH", body: JSON.stringify({ observacao }) });
      setAviso("Comentários salvos.");
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível salvar os comentários.");
    }
  };

  const copiar = async () => {
    try {
      const copia = await api<PedidoCompra>(`/pedidos-compra/${id}/copiar`, { method: "POST" });
      navigate(`${ROTA}/${copia.id}`);
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível copiar.");
    }
  };

  const escolherFornecedor = (f: FornecedorBusca | null) =>
    setDados((d) => ({
      ...d, fornecedor: f?.id ?? null, fornecedor_nome: f?.nome ?? null, fornecedor_documento: f ? f.cnpj || f.cpf : null,
      fornecedor_ie: f?.inscricao_estadual ?? null, fornecedor_email: f?.email ?? null, fornecedor_telefone: f?.telefone ?? null,
    }));

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;
  const situacao = SITUACAO[dados.situacao ?? "novo"];
  const enderecosEmpresa = (empresa?.enderecos ?? [])
    .filter((e) => e.logradouro)
    .map((e) => ({ cep: e.cep, logradouro: e.logradouro, numero: e.numero, complemento: "", bairro: e.bairro, cidade: e.cidade, uf: e.uf, ibge: "" }))
    // Faturamento e entregas da empresa costumam ser o mesmo endereço: um cartão só.
    .filter((e, n, todos) => todos.findIndex((x) => mesmoEndereco(x, e)) === n);
  const temFat = dados.sem_endereco_faturamento || !!dados.fat_logradouro;
  const temEnt = dados.sem_endereco_entrega || !!dados.ent_logradouro;
  // Passo a passo da MarketUP no pedido novo: fornecedor → endereço de faturamento → entrega → itens → pagamento.
  const mostraEnderecos = !!dados.fornecedor;
  const mostraItens = mostraEnderecos && temFat && temEnt;
  const mostraPagamento = mostraItens && dados.itens.length > 0;
  const percentual = (i: ItemOrcamento) => {
    const c = i as ItemCompra;
    if (!c.produto) return 100;
    return Math.min(100, Math.round((Number(c.recebido ?? 0) / Number(c.quantidade || 1)) * 100));
  };

  return (
    <>
      <PageHeader
        eyebrow="Compras"
        title="Pedido"
        acoes={
          <>
            <Link to={ROTA} aria-label="Listar pedidos" title="Listar" className={iconeTopo}><IconList size={28} aria-hidden /></Link>
            {editando && (
              <Link to={`${ROTA}/${id}/imprimir`} target="_blank" aria-label="Imprimir" title="Imprimir / PDF" className={iconeTopo}><IconPrinter size={28} aria-hidden /></Link>
            )}
            {editando && (
              <button type="button" disabled title="Envio por e-mail: chega com a configuração de e-mail" aria-label="Enviar por e-mail" className={cn(iconeTopo, "opacity-40")}><IconMail size={28} aria-hidden /></button>
            )}
            {editando && pode(ROTA, "adicionar") && (
              <button type="button" onClick={copiar} aria-label="Copiar pedido" title="Copiar (novo pedido igual)" className={iconeTopo}><IconCopy size={28} aria-hidden /></button>
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

        {/* ---- Pedido ---- */}
        <h2 className="mb-2 text-2xl font-normal text-ink md:text-[30px]">Pedido</h2>
        <div className={cn("flex flex-col border sm:flex-row", situacao.borda)}>
          <div className={cn("flex min-h-28 flex-col items-center justify-center px-6 text-3xl font-bold uppercase sm:w-[268px]", situacao.fundo)}>
            {situacao.rotulo}
            {(faturado || cancelado) && !cancelado && (
              <span className="mt-2 text-center text-[11px] font-semibold uppercase leading-tight">
                <span className="opacity-80">Recebimento:</span>{dados.recebimento_status}<br />
                <span className="opacity-80">Pagamento:</span> {dados.pagamento_status}
              </span>
            )}
          </div>
          <div className="grid flex-1 grid-cols-1 items-end gap-x-6 gap-y-3 p-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="flex items-center gap-2">
              {numero && <span className="text-4xl font-normal tabular-nums text-ink"><span className="mr-1 text-sm text-primary">#</span>{numero}</span>}
              <BalaoEdicao
                titulo="Comentários"
                tituloMaiusculo
                semCancelar
                rotuloConfirmar="Salvar"
                valorInicial={dados.observacao}
                disabled={!pode(ROTA, editando ? "alterar" : "adicionar") || cancelado}
                onConfirmar={salvarComentarios}
                gatilho={(abrir, abertoBalao) => (
                  <button type="button" onClick={abrir} aria-expanded={abertoBalao} aria-label="Comentários" title={dados.observacao || "Comentários"} className={cn("inline-flex size-12 shrink-0 items-center justify-center", dados.observacao ? "text-primary" : "text-ink-muted")}>
                    <IconMessage size={30} stroke={1.5} aria-hidden />
                  </button>
                )}
              />
            </div>
            <Data rotulo="Emissão" valor={dados.emissao} editavel={podeSalvar} invalido={!!erro("emissao")} onChange={(v) => set("emissao", v)} />
            <div className="row-span-2 flex flex-col justify-end gap-2 sm:col-start-3 sm:row-start-1">
              {aberto && (
                <>
                  <button type="button" onClick={concluir} disabled={salvando || !podeSalvar || !mostraPagamento} className="min-h-12 min-w-36 rounded-xs bg-success px-5 text-sm font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted">Concluir</button>
                  <button type="button" disabled className="min-h-12 min-w-36 rounded-xs bg-secondary-light px-5 text-sm font-bold uppercase text-ink-muted">Receber</button>
                </>
              )}
              {faturado && (
                <>
                  <button type="button" onClick={() => setModal({ tipo: "receber" })} disabled={!dados.itens_a_receber || !pode(ROTA, "alterar")} className="min-h-12 min-w-36 rounded-xs bg-primary px-5 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:bg-secondary-light disabled:text-ink-muted">Receber</button>
                  <button type="button" onClick={() => setModal({ tipo: "devolver" })} disabled={!dados.itens.some((i) => Number(i.recebido ?? 0) > 0) || !pode(ROTA, "alterar")} className="min-h-12 min-w-36 rounded-xs bg-secondary px-5 text-sm font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted">Devolver</button>
                </>
              )}
            </div>
            <label className="flex items-end gap-2">
              <span className="min-w-0 flex-1">
                <span className={rotuloMini}>Comprador</span>
                {podeSalvar ? (
                  <select value={dados.comprador ?? ""} onChange={(e) => set("comprador", e.target.value ? Number(e.target.value) : null)} className="h-10 w-full truncate border-0 bg-transparent p-0 text-xl font-semibold uppercase text-ink focus:outline-none">
                    <option value="">Selecione</option>
                    {compradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    {dados.comprador && !compradores.some((c) => c.id === dados.comprador) && <option value={dados.comprador}>{dados.comprador_nome}</option>}
                  </select>
                ) : (
                  <span className="block truncate text-xl font-semibold uppercase text-ink">{dados.comprador_nome || "—"}</span>
                )}
              </span>
              <IconUser size={28} aria-hidden className="mb-1 text-ink-muted" />
            </label>
            <Data rotulo="Recebimento" valor={dados.previsao ?? ""} editavel={podeSalvar} onChange={(v) => set("previsao", v || null)} />
          </div>
        </div>
        {erro("emissao") && <p className="mt-1 text-sm font-semibold text-error">{erro("emissao")}</p>}
        {cancelado && dados.data_cancelamento && <p className="mt-2 text-sm font-semibold text-error">Cancelado em {formatarData(dados.data_cancelamento)}.</p>}

        {/* ---- Fornecedor ---- */}
        <h2 className="mb-2 mt-8 text-2xl font-normal text-ink md:text-[30px]">Fornecedor</h2>
        <BuscaFornecedor
          nome={dados.fornecedor_nome ?? ""}
          disabled={!podeSalvar}
          erro={erro("fornecedor")}
          onEscolher={escolherFornecedor}
          onCadastrar={pode(ROTA_FORNECEDORES, "adicionar") ? async (nome) => {
            const f = await api<FornecedorBusca>("/fornecedores", { method: "POST", body: JSON.stringify({ nome, tipo_pessoa: "J" }) });
            escolherFornecedor(f);
            setAviso(`Fornecedor ${f.nome} cadastrado. Complete CNPJ, IE e contato na ficha do fornecedor.`);
          } : undefined}
        />
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[1fr_1fr_2fr_1fr]">
          {[
            ["CPF ou CNPJ", doc(dados.fornecedor_documento)],
            ["RG ou IE", dados.fornecedor_ie ?? ""],
            ["E-mail", dados.fornecedor_email ?? ""],
            ["Telefone", formatarTelefone(dados.fornecedor_telefone ?? "")],
          ].map(([r, v]) => (
            <label key={r}><span className="text-sm text-ink-muted">{r}</span><input readOnly value={v} className={cn(campoCaixa, "bg-surface normal-case")} /></label>
          ))}
        </div>
        {!dados.fornecedor && (
          <Guia titulo="Identificando o fornecedor">
            Para iniciar um novo pedido é necessário identificar o fornecedor, digite seu nome no campo acima para localizá-lo. Se for um fornecedor novo você poderá realizar seu cadastro agora!
          </Guia>
        )}

        {/* ---- Endereços da empresa ---- */}
        {mostraEnderecos && (
          <>
            <EnderecoPedido
              prefixo="fat"
              titulo="Endereço para faturamento"
              dados={dados}
              opcoes={enderecosEmpresa}
              editavel={podeSalvar}
              onEscolher={(e) => setDados((d) => ({
                ...d, ...comPrefixo("fat", e), sem_endereco_faturamento: false,
                // Como na MarketUP: a entrega vem igual ao faturamento até ser trocada.
                ...(d.ent_logradouro || d.sem_endereco_entrega ? {} : comPrefixo("ent", e)),
              }))}
              onEditar={(e) => setDados((d) => ({ ...d, ...comPrefixo("fat", e) }))}
            />
            {!temFat && (
              <Guia titulo="Endereço de Faturamento / Cobrança">
                Selecione o endereço de faturamento / cobrança da empresa para este pedido. Se for um novo endereço você poderá realizar seu cadastro agora!
                <button type="button" onClick={() => set("sem_endereco_faturamento", true)} className="mt-3 block text-xs font-bold uppercase text-error"><u>Clique aqui</u> para informar o endereço depois</button>
              </Guia>
            )}
            {temFat && (
              <EnderecoPedido
                prefixo="ent"
                titulo="Endereço de entrega"
                dados={dados}
                opcoes={enderecosEmpresa}
                editavel={podeSalvar}
                onEscolher={(e) => setDados((d) => ({ ...d, ...comPrefixo("ent", e), sem_endereco_entrega: false }))}
                onEditar={(e) => setDados((d) => ({ ...d, ...comPrefixo("ent", e) }))}
              />
            )}
            {temFat && !temEnt && (
              <Guia titulo="Endereço de Entrega">
                Selecione o endereço de entrega da empresa para este pedido. Se for um novo endereço você poderá realizar seu cadastro agora!
                <button type="button" onClick={() => set("sem_endereco_entrega", true)} className="mt-3 block text-xs font-bold uppercase text-error"><u>Clique aqui</u> para informar o endereço depois</button>
              </Guia>
            )}
          </>
        )}

        {/* ---- Itens ---- */}
        {mostraItens && (
          <>
            <h2 className="mb-2 mt-8 text-2xl font-normal text-ink md:text-[30px]">Itens</h2>
            {erro("itens") && <p role="alert" className="mb-2 text-sm font-semibold text-error">{erro("itens")}</p>}
            {podeSalvar && (
              <IncluirItem catalogo={catalogo} lista={null} precoSugerido={custo} rotuloIncluir="no pedido" onIncluir={(i) => setDados((d) => ({ ...d, itens: [...d.itens, i as ItemCompra], parcelas: [] }))} />
            )}
            {dados.itens.length > 0 && (
              <TabelaItens
                itens={dados.itens as ItemOrcamento[]}
                unidades={unidades}
                catalogo={[]}
                lista={null}
                podeSalvar={podeSalvar}
                formatoMarketup
                // Como na MarketUP (calcTotals): mexer nos itens antes de concluir apaga as parcelas geradas.
                onChange={(itens) => setDados((d) => ({ ...d, itens: itens as ItemCompra[], parcelas: [] }))}
                colunaExtra={
                  faturado || cancelado
                    ? {
                        titulo: "Entrega",
                        celula: (i) => (
                          <span className={cn("flex min-h-[78px] flex-col items-center justify-center", percentual(i) >= 100 ? "bg-primary/70 text-primary-foreground" : "bg-line text-ink")}>
                            <span className="text-2xl font-bold tabular-nums">{percentual(i)}%</span>
                            <span className="text-[10px] font-semibold uppercase">{percentual(i) >= 100 ? "Realizada" : "Pendente"}</span>
                          </span>
                        ),
                      }
                    : undefined
                }
              />
            )}
            {dados.itens.length === 0 && (
              <Guia titulo="Adicionando itens para compra">
                Informe o nome ou o código de barras do item para localizá-lo, preencha a quantidade, confirme os valores e clique em INCLUIR NO PEDIDO
              </Guia>
            )}
          </>
        )}

        {mostraPagamento && (
          <>
            <div className="mt-2 flex flex-col items-end">
              <p className="text-[11px] uppercase text-primary">Subtotal (R$)</p>
              <Valor valor={totais.subtotal} className="text-2xl text-primary" />
              <div className="mt-2 w-full max-w-[582px] border-y-4 border-primary bg-surface px-4 py-3">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
                  <span className="flex items-center justify-end gap-2 uppercase">
                    Desconto
                    {podeSalvar && <BotoesRP valor={dados.desconto_em_percentual} onChange={(v) => setDados((d) => ({ ...d, desconto_em_percentual: v, parcelas: [] }))} />}
                  </span>
                  <CampoValor
                    valor={dados.desconto_em_percentual ? dados.desconto_percentual : dados.desconto}
                    prefixo={dados.desconto_em_percentual ? "%" : "R$"}
                    rotulo="Desconto"
                    disabled={!podeSalvar}
                    erro={erro("desconto")}
                    onChange={(v) => setDados((d) => ({ ...d, [d.desconto_em_percentual ? "desconto_percentual" : "desconto"]: v, parcelas: [] }))}
                  />
                  <IconCircleMinus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
                  <span className="text-right uppercase">Frete</span>
                  <CampoValor valor={dados.frete} prefixo="R$" rotulo="Frete" disabled={!podeSalvar} onChange={(v) => setDados((d) => ({ ...d, frete: v, parcelas: [] }))} />
                  <IconCirclePlus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
                  <span className="flex items-center justify-end gap-2 uppercase">
                    <IconInfoCircle size={22} aria-label="Outros custos: impostos, seguro e outras despesas da compra" className="text-ink-muted" />
                    Outros custos
                  </span>
                  <CampoValor valor={dados.outros_custos} prefixo="R$" rotulo="Outros custos" disabled={!podeSalvar} onChange={(v) => setDados((d) => ({ ...d, outros_custos: v, parcelas: [] }))} />
                  <IconCirclePlus size={26} stroke={1.5} aria-hidden className="text-ink-muted" />
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
            {aberto ? (
              <Pagamento
                tipos={tipos}
                parcelas={dados.parcelas as ParcelaOrcamento[]}
                total={totais.total}
                podeSalvar={podeSalvar}
                erro={erro("parcelas")}
                apiBase="/pedidos-compra"
                nome="pedido"
                finalidade="compras"
                rotuloTotal="Valor total (R$)"
                consultaExtra={dados.conta_gerencial ? `&conta_gerencial=${dados.conta_gerencial}` : ""}
                antesDaForma={
                  <label className="text-right text-[11px] uppercase">
                    Conta gerencial
                    <select value={dados.conta_gerencial ?? ""} onChange={(e) => set("conta_gerencial", e.target.value ? Number(e.target.value) : null)} className={cn(campoCaixa, "mt-1 text-ink")}>
                      <option value="" />
                      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                }
                onChange={(p) => set("parcelas", p as ParcelaCompra[])}
              />
            ) : (
              <PagamentoCompraFaturado parcelas={dados.parcelas} pendente={Number(dados.saldo_pagar ?? 0)} podePagar={pode("/financeiro/contas-a-pagar", "alterar")} />
            )}
          </>
        )}

        <BarraAcoes
          voltar={ROTA}
          aviso={aviso}
          erro={!!Object.keys(erros).length}
          podeSalvar={podeSalvar}
          salvando={salvando}
          onSalvarEVoltar={salvar(true)}
          extras={
            // Ordem da MarketUP: novo = CANCELAR · CONCLUIR COMPRA · SALVAR · SALVAR E VOLTAR; concluído = CANCELAR · DEVOLVER · RECEBER.
            <>
              {!cancelado && pode(ROTA, editando ? "alterar" : "adicionar") && (
                <button type="button" onClick={pedirCancelamento} className="min-h-12 rounded-xs bg-error px-6 text-sm font-bold uppercase text-surface-raised hover:opacity-90">Cancelar</button>
              )}
              {aberto && podeSalvar && (
                <button type="button" onClick={concluir} disabled={salvando || !mostraPagamento} className="min-h-12 rounded-xs bg-success px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted">Concluir compra</button>
              )}
              {faturado && (
                <>
                  <button type="button" onClick={() => setModal({ tipo: "devolver" })} disabled={!dados.itens.some((i) => Number(i.recebido ?? 0) > 0) || !pode(ROTA, "alterar")} className="min-h-12 rounded-xs bg-secondary px-6 text-sm font-bold uppercase text-surface-raised hover:opacity-90 disabled:bg-secondary-light disabled:text-ink-muted">Devolver</button>
                  <button type="button" onClick={() => setModal({ tipo: "receber" })} disabled={!dados.itens_a_receber || !pode(ROTA, "alterar")} className="min-h-12 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:bg-secondary-light disabled:text-ink-muted">Receber</button>
                </>
              )}
            </>
          }
        />
      </form>

      {mensagem && <ModalAviso mensagem={mensagem} onFechar={() => setMensagem("")} />}
      {modal?.tipo === "custos" && (
        <Modal
          titulo="Atualizar custo"
          onFechar={() => setModal(null)}
          largura="max-w-[560px]"
          rodape={
            <>
              <button type="button" onClick={() => faturar(modal.n, false)} className={botaoCancelar}>Não</button>
              <button type="button" data-autofocus onClick={() => faturar(modal.n, true)} className={botaoConfirmar}>Sim</button>
            </>
          }
        >
          <p className="px-1 text-sm font-semibold text-ink">Deseja atualizar o preço de custo dos seguintes itens?</p>
          <ul className="mt-2 space-y-1 px-1 text-sm">
            {modal.itens.map((i) => (
              <li key={i.descricao}>- <strong>{i.descricao}</strong> → de: <strong>{formatarMoeda(i.de)}</strong> para: <strong>{formatarMoeda(i.para)}</strong></li>
            ))}
          </ul>
        </Modal>
      )}
      {modal?.tipo === "cancelar" && (
        <ConfirmDialog
          title="Cancelar pedido"
          message="Deseja mesmo cancelar este pedido? Esta operação não poderá ser desfeita!"
          confirmLabel="Cancelar pedido"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            setModal(null);
            void acao(`${id}/cancelar`, {}, (n) => `Pedido Nº ${n} cancelado com sucesso!`);
          }}
        />
      )}
      {modal?.tipo === "cancelarComValor" && numero && (
        <CancelarCompraModal
          numero={numero}
          pago={modal.pago}
          itensRecebidos={modal.itens}
          tipos={tipos}
          onFechar={() => setModal(null)}
          onConfirmar={(corpo) => {
            setModal(null);
            void acao(`${id}/cancelar`, corpo, (n) => `Pedido Nº ${n} cancelado com sucesso!`);
          }}
        />
      )}
      {modal?.tipo === "receber" && numero && (
        <ReceberCompraModal
          pedido={{ ...dados, id: numero }}
          onFechar={() => setModal(null)}
          onConfirmar={(corpo) => {
            setModal(null);
            void acao(`${id}/receber`, corpo, (n) => `Pedido Nº ${n} entregue com sucesso!`);
          }}
        />
      )}
      {modal?.tipo === "devolver" && numero && (
        <DevolucaoCompraModal
          pedido={{ ...dados, id: numero }}
          tipos={tipos}
          onFechar={() => setModal(null)}
          onConfirmar={(corpo) => {
            setModal(null);
            void acao(`${id}/devolver`, corpo, () => "Devolução/troca realizada com sucesso!");
          }}
        />
      )}
    </>
  );
}

/** Data da faixa do pedido: texto grande; no pedido novo, com o ícone de calendário (como a MarketUP). */
function Data({ rotulo, valor, editavel, invalido, onChange }: { rotulo: string; valor: string; editavel: boolean; invalido?: boolean; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={rotuloMini}>{rotulo}</span>
      {editavel ? (
        <span className="flex items-center gap-2">
          <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo} aria-invalid={invalido} className="h-10 w-40 border-0 bg-transparent p-0 text-xl tabular-nums text-ink focus:outline-none aria-[invalid=true]:text-error [&::-webkit-calendar-picker-indicator]:opacity-0" />
          <IconCalendar size={28} stroke={1.5} aria-hidden className="pointer-events-none -ml-10 text-ink-muted" />
        </span>
      ) : (
        <span className="block h-10 text-xl leading-10 tabular-nums text-ink">{formatarData(valor) || "—"}</span>
      )}
    </label>
  );
}

/**
 * Endereço do pedido (da empresa). Pedido novo: cartões com os endereços da empresa — o escolhido fica destacado com o lápis para
 * ajustar — e "não informar" (setSkipAddress). Concluído: faixa larga com o CEP grande à esquerda e o botão "Etiqueta".
 */
function EnderecoPedido({ prefixo, titulo, dados, opcoes, editavel, onEscolher, onEditar }: {
  prefixo: Prefixo;
  titulo: string;
  dados: Dados;
  opcoes: EnderecoTexto[];
  editavel: boolean;
  onEscolher: (e: EnderecoTexto) => void;
  onEditar: (e: Partial<EnderecoTexto>) => void;
}) {
  const atual = endereco(dados, prefixo);
  const sem = prefixo === "fat" ? dados.sem_endereco_faturamento : dados.sem_endereco_entrega;
  const [editando, setEditando] = useState(false);
  const cartoes = [...opcoes];
  if (atual.logradouro && !cartoes.some((o) => mesmoEndereco(o, atual))) cartoes.unshift(atual);

  if (!editavel) {
    return (
      <div className="mt-5">
        <h3 className="mb-1 border-b border-line pb-1 text-xs font-semibold uppercase text-ink">{titulo}</h3>
        {sem || !atual.logradouro ? (
          <p className="bg-surface px-4 py-3 text-sm text-ink-muted">Não informado.</p>
        ) : (
          <div className="flex flex-col bg-surface sm:flex-row">
            <div className="flex flex-col items-end justify-center bg-line px-5 py-2 sm:w-[268px]">
              <span className="text-3xl tabular-nums text-ink">{formatarCep(atual.cep) || "—"}</span>
              <span className="text-lg text-ink-muted">{atual.cidade}/{atual.uf}</span>
            </div>
            <div className="flex flex-1 items-center gap-3 px-5 py-2">
              <span className="flex-1">
                <span className="block text-3xl text-ink">{[atual.logradouro, atual.numero].filter(Boolean).join(", ")}</span>
                <span className="text-lg text-ink-muted">{[atual.complemento, atual.bairro].filter(Boolean).join(" - ")}</span>
              </span>
              <button type="button" onClick={() => imprimirEtiqueta(dados.fornecedor_nome ?? "", atual)} className="flex flex-col items-center text-[10px] uppercase text-ink hover:text-primary">
                <IconPrinter size={26} aria-hidden />
                Etiqueta
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5">
      <h3 className="mb-1 border-b border-line pb-1 text-xs font-semibold uppercase text-ink">{titulo}</h3>
      {sem ? (
        <p className="text-sm text-ink-muted">
          Endereço a informar depois.{" "}
          <button type="button" onClick={() => onEscolher(opcoes[0] ?? atual)} className="font-semibold text-primary underline">Informar agora</button>
        </p>
      ) : (
        <div className="flex flex-col gap-1 sm:flex-row">
          <div className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-3">
            {cartoes.map((e, n) => {
              const escolhido = !!atual.logradouro && mesmoEndereco(e, atual);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => (escolhido ? setEditando(true) : onEscolher(e))}
                  aria-pressed={escolhido}
                  className={cn("relative flex min-h-[90px] flex-col items-start p-3 text-left text-sm", escolhido ? "bg-primary text-primary-foreground" : "bg-surface text-ink hover:bg-primary-light")}
                >
                  {escolhido && <IconPencil size={16} aria-label="Alterar este endereço" className="absolute right-2 top-2" />}
                  <span className="font-bold tabular-nums">{formatarCep(e.cep)} <span className="font-normal opacity-80">({e.cidade} /{e.uf})</span></span>
                  <span>{[e.logradouro, e.numero].filter(Boolean).join(", ")}{e.bairro ? ` - ${e.bairro}` : ""}</span>
                  {e.complemento && <span className="text-xs opacity-80">{e.complemento}</span>}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onEditar(Object.fromEntries(CAMPOS_ENDERECO.map((c) => [c, ""])) as EnderecoTexto);
              setEditando(true);
            }}
            aria-label="Novo endereço"
            title="Informar outro endereço"
            className="flex min-h-[90px] items-center justify-center bg-secondary px-6 text-surface-raised hover:opacity-90"
          >
            <IconCirclePlus size={44} stroke={1.5} aria-hidden />
          </button>
        </div>
      )}
      {editando && !sem && (
        <div className="mt-2 grid grid-cols-1 gap-2 bg-surface p-3 sm:grid-cols-6">
          {([["cep", "CEP", ""], ["logradouro", "Endereço", "sm:col-span-3"], ["numero", "Nº", ""], ["complemento", "Complemento", ""], ["bairro", "Bairro", "sm:col-span-2"], ["cidade", "Cidade", "sm:col-span-2"], ["uf", "UF", ""]] as const).map(([c, r, classe]) => (
            <label key={c} className={classe}>
              <span className="text-sm text-ink-muted">{r}</span>
              <input value={atual[c]} maxLength={c === "uf" ? 2 : 150} onChange={(e) => onEditar({ [c]: c === "uf" ? e.target.value.toUpperCase() : e.target.value })} className={campoCaixa} />
            </label>
          ))}
          <button type="button" onClick={() => setEditando(false)} className="min-h-10 self-end rounded-xs bg-secondary px-4 text-sm font-bold uppercase text-surface-raised">OK</button>
        </div>
      )}
    </div>
  );
}

/** Etiqueta de endereçamento (botão "ETIQUETA" da MarketUP): abre a etiqueta para imprimir. */
function imprimirEtiqueta(nome: string, e: EnderecoTexto) {
  const janela = window.open("", "_blank", "width=480,height=320");
  if (!janela) return;
  const linhas = [nome, [e.logradouro, e.numero].filter(Boolean).join(", "), [e.complemento, e.bairro].filter(Boolean).join(" - "), `${e.cidade}/${e.uf}`, `CEP ${formatarCep(e.cep)}`]
    .filter(Boolean)
    .map((l) => `<div>${l.replace(/[<>&]/g, "")}</div>`)
    .join("");
  janela.document.write(`<html><head><title>Etiqueta</title></head><body style="font-family:sans-serif;font-size:16px;padding:16px">${linhas}<script>window.print()</script></body></html>`);
  janela.document.close();
}

/**
 * Pagamento do pedido concluído (MarketUP): cabeçalho Parcela · Vencimento (observações) · Valor · Saldo e, à direita, "Valor
 * pendente de pagamento"; as parcelas agrupadas por forma ("PIX (À VISTA)") com o valor e o saldo em caixas e o botão PAGAR.
 */
function PagamentoCompraFaturado({ parcelas, pendente, podePagar }: { parcelas: ParcelaCompra[]; pendente: number; podePagar: boolean }) {
  const navigate = useNavigate();
  if (parcelas.length === 0) return <p className="bg-surface p-4 text-sm text-ink-muted">Sem parcelas (pedido cancelado: as contas a pagar foram retiradas).</p>;
  const grupos: { titulo: string; itens: ParcelaCompra[] }[] = [];
  parcelas.forEach((p) => {
    const titulo = `${p.tipo_pagamento_nome ?? "Importado XML"}${p.condicao_pagamento_nome ? `  (${p.condicao_pagamento_nome})` : ""}`.toUpperCase();
    const chave = p.grupo || titulo;
    const g = grupos.find((x) => (x as { chave?: string }).chave === chave);
    if (g) g.itens.push(p);
    else grupos.push(Object.assign({ titulo, itens: [p] }, { chave }));
  });
  const caixa = "inline-flex h-9 w-28 items-center justify-end border border-line bg-surface-raised px-2 text-sm tabular-nums text-ink";
  return (
    <div className="bg-surface">
      <div className="grid grid-cols-[1fr_auto] items-stretch bg-line">
        <div className="hidden grid-cols-[6rem_1fr_8rem_8rem] items-center gap-3 px-4 py-3 text-xs font-semibold uppercase text-ink md:grid">
          <span>Parcela</span><span>Vencimento <span className="font-normal normal-case text-ink-muted">(observações)</span></span><span className="text-right">Valor</span><span className="text-right">Saldo</span>
        </div>
        <div className="flex flex-col items-end justify-center bg-secondary-light px-4 py-2 md:w-[336px]">
          <span className="text-[11px] uppercase text-ink">Valor pendente de pagamento (R$)</span>
          <Valor valor={pendente} className="text-2xl text-ink-muted" />
        </div>
      </div>
      {grupos.map((g) => (
        <section key={g.titulo + g.itens[0].id} className="px-4 py-3" aria-label={g.titulo}>
          <h3 className="mb-2 text-sm font-bold text-ink">{g.titulo}</h3>
          {g.itens.map((p, n) => (
            <div key={p.id ?? n} className="grid grid-cols-2 items-center gap-3 py-1 md:grid-cols-[6rem_1fr_8rem_8rem_1fr]">
              <span className="self-start text-xs text-ink-muted">[{p.numero}/{p.quantidade}]</span>
              <span>
                <span className="block text-xl tabular-nums text-ink">{formatarData(p.vencimento)}</span>
                {p.descricao && <span className="text-xs text-ink-muted">{p.descricao}</span>}
              </span>
              <span className={caixa}>{formatarMoeda(p.valor)}</span>
              <span className={caixa}>{formatarMoeda(p.saldo ?? p.valor)}</span>
              <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                {Number(p.saldo ?? p.valor) > 0 ? (
                  <button
                    type="button"
                    disabled={!p.conta_pagar || !podePagar}
                    title={p.conta_pagar ? "Pagar na conta a pagar" : "Conta a pagar ainda não carregada da MarketUP"}
                    onClick={() => p.conta_pagar && navigate(`/financeiro/contas-a-pagar/${p.conta_pagar}`)}
                    className="min-h-10 min-w-24 rounded-xs bg-success px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90 disabled:opacity-50"
                  >
                    Pagar
                  </button>
                ) : (
                  <button type="button" disabled={!p.conta_pagar} onClick={() => p.conta_pagar && navigate(`/financeiro/contas-a-pagar/${p.conta_pagar}`)} aria-label={`Ver a conta a pagar da parcela ${p.numero}`} title="Ver a conta a pagar" className="inline-flex size-10 items-center justify-center text-primary hover:bg-primary-light disabled:opacity-40">
                    <IconSearch size={20} aria-hidden />
                  </button>
                )}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Busca de fornecedor ("(CNPJ) RAZÃO SOCIAL (FANTASIA)", a partir da 3ª letra) e "Cadastrar novo fornecedor", como na MarketUP. */
function BuscaFornecedor({ nome, disabled, erro, onEscolher, onCadastrar }: {
  nome: string;
  disabled: boolean;
  erro?: string;
  onEscolher: (f: FornecedorBusca | null) => void;
  onCadastrar?: (nome: string) => Promise<void>;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<FornecedorBusca[]>([]);
  const [buscando, setBuscando] = useState(!nome);
  const [erroCadastro, setErroCadastro] = useState("");
  useEffect(() => {
    if (termo.trim().length < 3) return setResultados([]);
    const t = window.setTimeout(() => {
      api<{ results: FornecedorBusca[] }>(`/fornecedores?search=${encodeURIComponent(termo.trim())}&page_size=15&bloqueado=false`).then((r) => setResultados(r.results), () => setResultados([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [termo]);

  if (nome && !buscando) {
    return (
      <div className="flex items-center gap-4 border-b-4 border-secondary-light bg-line px-5">
        <span className="h-16 flex-1 truncate text-3xl leading-[4rem] text-ink md:text-4xl">{nome}</span>
        {!disabled && (
          <button type="button" onClick={() => { setBuscando(true); setTermo(""); onEscolher(null); }} aria-label="Trocar fornecedor" title="Trocar fornecedor" className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light">
            <IconSearch size={22} aria-hidden />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex flex-col border-b-4 border-secondary-light bg-line sm:flex-row">
        <input aria-label="Buscar fornecedor" placeholder="Nome do fornecedor" value={termo} disabled={disabled} onChange={(e) => { setTermo(e.target.value); setErroCadastro(""); }} aria-invalid={!!erro} className="h-16 min-w-0 flex-1 bg-transparent px-5 text-3xl text-ink placeholder:text-ink-muted focus:outline-none md:text-4xl" />
        {onCadastrar && !disabled && termo.trim().length >= 3 && (
          <button
            type="button"
            onClick={async () => {
              try {
                await onCadastrar(termo.trim());
                setBuscando(false);
              } catch (e) {
                setErroCadastro(e instanceof ApiError ? e.message : "Não foi possível cadastrar o fornecedor.");
              }
            }}
            className="flex min-h-16 flex-col items-center justify-center bg-secondary px-6 text-center font-bold uppercase leading-tight text-surface-raised hover:opacity-90 sm:w-[240px]"
          >
            Cadastrar<span className="text-sm font-normal">novo fornecedor</span>
          </button>
        )}
      </div>
      {(erro || erroCadastro) && <p role="alert" className="mt-1 text-xs font-semibold text-error">{erroCadastro || erro}</p>}
      {resultados.length > 0 && (
        <ul className="absolute z-20 w-full overflow-y-auto bg-secondary text-surface-raised shadow-lg sm:w-[75%]">
          {resultados.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { setBuscando(false); setResultados([]); onEscolher(f); }} className="min-h-10 w-full px-5 py-2 text-left text-sm uppercase hover:bg-primary hover:text-primary-foreground">
                {(f.cnpj || f.cpf) && <span className="tabular-nums">({f.cnpj || f.cpf}) </span>}
                <strong>{f.nome}</strong>
                {f.apelido && f.apelido !== f.nome && <> (<strong>{f.apelido}</strong>)</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
