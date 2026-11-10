import { IconBarcode, IconFileInvoice, IconSearch, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { botaoConfirmar } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarData, formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { ReciboModal } from "@/resources/pedidos/ModaisPedido";

import { BarraAcoes } from "./BarraAcoes";
import { LADO, linkOrigem, statusTitulo, type Baixa, type Lado, type Titulo } from "./titulos";
import type { ContaCorrente, ContaGerencial, TipoPagamento } from "./types";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const campo = "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none disabled:bg-surface md:h-[34px] md:text-sm";
const rotulo = "mb-1 block text-xs font-semibold uppercase text-ink";
const campoPainel = "h-12 w-full rounded-xs border border-secondary bg-secondary-light/30 px-3 text-right text-base text-surface-raised focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm";
const rotuloPainel = "text-right text-xs uppercase text-surface-raised/80";

type Dados = Partial<Titulo> & Pick<Titulo, "descricao" | "emissao" | "vencimento" | "valor" | "observacao" | "documento" | "codigo_barras">;
const VAZIO: Dados = { descricao: "", emissao: hoje(), vencimento: hoje(), valor: "0.00", observacao: "", documento: "", codigo_barras: "", conta_gerencial: null, baixas: [] };
const amortizado = (b: Pick<Baixa, "valor" | "desconto" | "juros">) => arred(Number(b.valor || 0) + Number(b.desconto || 0) - Number(b.juros || 0));

export function ContaReceberForm() {
  return <TituloForm lado="receber" />;
}

export function ContaPagarForm() {
  return <TituloForm lado="pagar" />;
}

/**
 * Ficha da conta a receber / a pagar (receivable/detail e payable/detail da MarketUP).
 * "Incluir recebimento" acrescenta na lista; o X tira da lista; tudo grava junto no Salvar.
 */
function TituloForm({ lado }: { lado: Lado }) {
  const t = LADO[lado];
  const { id } = useParams();
  const novo = id === undefined || id === "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [manter, setManter] = useState<Baixa[]>([]);
  const [novas, setNovas] = useState<Baixa[]>([]);
  const [repetir, setRepetir] = useState(0);
  const [gerenciais, setGerenciais] = useState<ContaGerencial[]>([]);
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [recibo, setRecibo] = useState(false);
  const [juros, setJuros] = useState<{ diferenca: number } | null>(null);
  // Painel "Efetuar recebimento".
  const [painel, setPainel] = useState({ data: hoje(), conta_corrente: "" as number | "", juros: "0", desconto: "0", valor: null as string | null, tipo_pagamento: "" as number | "", observacao: "" });

  const set = (p: Partial<Dados>) => setDados((d) => ({ ...d, ...p }));
  const podeSalvar = pode(t.rota, novo ? "adicionar" : "alterar") && !dados.cancelada;
  const temBaixa = manter.length + novas.length > 0;
  const deDocumento = !novo && !dados.manual;

  useEffect(() => {
    api<{ results: ContaGerencial[] }>("/contas-gerenciais?page_size=200&ordering=nome").then(
      (r) => setGerenciais(r.results.filter((g) => g.ativo && (lado === "pagar" || g.tipo === "E"))),
      () => undefined,
    );
    api<{ results: ContaCorrente[] }>("/contas-correntes?page_size=100").then((r) => {
      const ativas = r.results.filter((c) => c.ativo);
      setContas(ativas);
      const principal = ativas.find((c) => c.principal);
      if (principal) setPainel((p) => ({ ...p, conta_corrente: p.conta_corrente || principal.id }));
    }, () => undefined);
    api<{ results: TipoPagamento[] }>("/tipos-pagamento?page_size=200").then((r) => setTipos(r.results.filter((x) => x.ativo)), () => undefined);
    if (!novo) carregar();
  }, [id, lado]); // eslint-disable-line react-hooks/exhaustive-deps

  function carregar() {
    return api<Titulo>(`${t.api}/${id}`).then(
      (x) => {
        setDados(x);
        setManter(x.baixas);
        setNovas([]);
        setPainel((p) => ({ ...p, tipo_pagamento: p.tipo_pagamento || x.tipo_pagamento || "", valor: null, juros: "0", desconto: "0", observacao: "" }));
      },
      (e: ApiError) => setAviso(e.message),
    );
  }

  const saldo = useMemo(() => {
    const s = arred(Number(dados.valor || 0) - [...manter, ...novas].reduce((acc, b) => acc + amortizado(b), 0));
    return s < 0.009 ? 0 : s;
  }, [dados.valor, manter, novas]);
  // Valor recebido sugerido = saldo + juros − desconto (o "=" do painel).
  const sugerido = arred(saldo + Number(painel.juros || 0) - Number(painel.desconto || 0));
  const valorPainel = painel.valor ?? String(Math.max(sugerido, 0));
  // Status como a MarketUP (getEventStatus), recalculado com o saldo da tela.
  const situacaoTela = (() => {
    if (saldo < 0.009) return "quitada";
    const dias = Math.round((new Date(`${dados.vencimento}T00:00`).getTime() - new Date(`${hoje()}T00:00`).getTime()) / 86400000);
    const base = dias === 0 ? "hoje" : dias > 0 ? "a_vencer" : "vencida";
    return Math.abs(saldo - Number(dados.valor || 0)) > 0.009 ? `${base}_parcial` : base;
  })();
  const status = novo ? { rotulo: "Novo", faixa: "bg-primary text-primary-foreground" } : statusTitulo(dados.cancelada ? "cancelada" : situacaoTela, lado);

  const incluir = (forcarJuros = false) => {
    const valor = Number(valorPainel || 0);
    let j = Number(painel.juros || 0);
    const desc = Number(painel.desconto || 0);
    if (valor < 0 || j < 0 || desc < 0 || valor + j + desc <= 0) return setAviso(`${t.verbo.charAt(0).toUpperCase() + t.verbo.slice(1)} inválido, verifique os valores informados.`);
    if (!painel.conta_corrente) return setAviso(`Informe a conta corrente do ${t.verbo}.`);
    const diferenca = arred(valor + desc - j - saldo);
    if (diferenca > 0.001) {
      if (!forcarJuros) return setJuros({ diferenca });
      j = arred(j + diferenca);
    }
    const conta = contas.find((c) => c.id === painel.conta_corrente);
    const tipo = tipos.find((x) => x.id === painel.tipo_pagamento);
    setNovas((l) => [...l, {
      data: painel.data, valor: valor.toFixed(2), juros: j.toFixed(2), desconto: desc.toFixed(2), conta_corrente: painel.conta_corrente || null,
      conta_corrente_nome: conta?.nome, tipo_pagamento: painel.tipo_pagamento || null, tipo_pagamento_nome: tipo?.descricao, observacao: painel.observacao,
    }]);
    setPainel((p) => ({ ...p, juros: "0", desconto: "0", valor: null, observacao: "" }));
    setAviso("");
  };

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo: Record<string, unknown> = {
      descricao: dados.descricao, conta_gerencial: dados.conta_gerencial, emissao: dados.emissao, vencimento: dados.vencimento, valor: dados.valor,
      observacao: dados.observacao, documento: dados.documento, codigo_barras: dados.codigo_barras, tipo_pagamento: dados.tipo_pagamento ?? null,
      novas_baixas: novas.map(({ conta_corrente_nome: _c, tipo_pagamento_nome: _t, ...b }) => b), manter_baixas: manter.map((b) => b.id),
    };
    if (lado === "receber") corpo.cliente = dados.cliente ?? null;
    else {
      // Um beneficiário só: fornecedor, cliente ou funcionário (a API limpa os outros).
      corpo.fornecedor = dados.fornecedor ?? null;
      corpo.cliente = dados.cliente ?? null;
      corpo.funcionario = dados.funcionario ?? null;
      if (!dados.fornecedor && !dados.cliente && !dados.funcionario) corpo.beneficiario_nome = dados.beneficiario_nome ?? "";
    }
    if (novo) corpo.repetir = repetir;
    if (deDocumento) {
      delete corpo.descricao;
      delete corpo.valor;
      delete corpo.cliente;
      delete corpo.fornecedor;
      delete corpo.funcionario;
    }
    if (temBaixa && !novo) {
      delete corpo.valor;
      delete corpo.emissao;
      delete corpo.vencimento;
    }
    try {
      const salvo = await api<Titulo>(novo ? t.api : `${t.api}/${id}`, { method: novo ? "POST" : "PATCH", body: JSON.stringify(corpo) });
      if (voltar) return navigate(t.rota);
      if (novo) return navigate(`${t.rota}/${salvo.id}`, { replace: true });
      setDados(salvo);
      setManter(salvo.baixas);
      setNovas([]);
      setAviso("Operação registrada com sucesso!");
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  const erro = (k: string) => {
    const v = erros[k];
    return v ? (Array.isArray(v) ? v.join(" ") : String(v)) : undefined;
  };
  const origem = !novo && dados.origem_id ? linkOrigem(dados as Titulo) : null;
  const historico = [...manter.map((b) => ({ ...b, nova: false })), ...novas.map((b) => ({ ...b, nova: true }))];

  return (
    <>
      <PageHeader eyebrow="Financeiro" title={t.titulo} />
      <form onSubmit={salvar(false)} noValidate className="mx-auto grid max-w-[992px] grid-cols-1 gap-6 px-4 pb-28 pt-8 md:grid-cols-[1fr_380px] xl:px-0">
        {/* ---- Dados da conta ---- */}
        <div className="space-y-4">
          <div>
            <IconBarcode size={48} stroke={1} className="text-ink-muted" aria-hidden />
            <input aria-label="Código de barras" value={dados.codigo_barras} onChange={(e) => set({ codigo_barras: e.target.value })} disabled={!podeSalvar} placeholder="Código de barras / linha digitável" className={cn(campo, "tabular-nums")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={rotulo}>Classificação</span>
              <select value={dados.conta_gerencial ?? ""} onChange={(e) => set({ conta_gerencial: e.target.value ? Number(e.target.value) : null })} disabled={!podeSalvar} aria-invalid={!!erro("conta_gerencial")} className={campo}>
                <option value="">Selecione</option>
                {gerenciais.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
              {erro("conta_gerencial") && <span className="text-xs font-semibold text-error">{erro("conta_gerencial")}</span>}
            </label>
            <label>
              <span className={cn(rotulo, "flex justify-between")}>
                Descrição
                {origem && (
                  <Link to={origem} className="inline-flex items-center gap-1 normal-case text-primary">
                    Ver origem <IconSearch size={14} aria-hidden />
                  </Link>
                )}
              </span>
              <input value={dados.descricao} onChange={(e) => set({ descricao: e.target.value })} disabled={!podeSalvar || deDocumento} maxLength={300} aria-invalid={!!erro("descricao")} className={campo} />
              {erro("descricao") && <span className="text-xs font-semibold text-error">{erro("descricao")}</span>}
            </label>
          </div>
          {lado === "receber" ? (
            <BuscaSacado nome={dados.pessoa_nome ?? ""} disabled={!podeSalvar || deDocumento} onEscolher={(cliente, nome) => set({ cliente, pessoa_nome: nome })} />
          ) : (
            <BuscaBeneficiario
              nome={dados.pessoa_nome ?? ""}
              disabled={!podeSalvar || deDocumento}
              onEscolher={(b) => set({ fornecedor: b?.tipo === "fornecedor" ? b.id : null, cliente: b?.tipo === "cliente" ? b.id : null, funcionario: b?.tipo === "funcionario" ? b.id : null, beneficiario_nome: "", pessoa_nome: b?.nome ?? "" })}
            />
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
            <label>
              <span className={rotulo}>Observações</span>
              <textarea value={dados.observacao} onChange={(e) => set({ observacao: e.target.value })} disabled={!podeSalvar} rows={6} className={cn(campo, "h-auto py-2 md:h-auto")} />
            </label>
            <div className="space-y-3">
              <label className="block">
                <span className={cn(rotulo, "text-right")}>Emissão</span>
                <input type="date" value={dados.emissao} onChange={(e) => set({ emissao: e.target.value })} disabled={!podeSalvar || (temBaixa && !novo)} className={campo} />
              </label>
              <label className="block">
                <span className={cn(rotulo, "text-right")}>Vencimento</span>
                <input type="date" value={dados.vencimento} onChange={(e) => set({ vencimento: e.target.value })} disabled={!podeSalvar || (temBaixa && !novo)} aria-invalid={!!erro("vencimento")} className={campo} />
                {erro("vencimento") && <span className="text-xs font-semibold text-error">{erro("vencimento")}</span>}
              </label>
              <label className="block">
                <span className={cn(rotulo, "text-right")}>Valor total</span>
                <CampoNumero value={dados.valor} prefixo="R$ " onChange={(v) => set({ valor: v })} disabled={!podeSalvar || (temBaixa && !novo) || deDocumento} aria-invalid={!!erro("valor")} className={cn(campo, "text-right tabular-nums")} />
                {erro("valor") && <span className="text-xs font-semibold text-error">{erro("valor")}</span>}
              </label>
            </div>
          </div>
          {novo && (
            <label className="block sm:w-1/2">
              <span className={rotulo}>{lado === "receber" ? "Repetir" : "Intervalo"}</span>
              <select value={repetir} onChange={(e) => setRepetir(Number(e.target.value))} className={campo}>
                <option value={0}>Não repetir</option>
                {Array.from({ length: 11 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n + 1} vezes (mensal)</option>)}
              </select>
            </label>
          )}

          {/* ---- Histórico ---- */}
          <h3 className="border-b border-line pb-1 text-sm uppercase text-ink">Histórico de {t.verbo}s realizados</h3>
          {historico.length === 0 ? (
            <p className="border-b border-line py-3 text-center text-sm font-semibold text-error">Nenhum {t.verbo} foi efetuado para esta conta até o momento!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink">
                    <th className="py-1">Data</th><th className="text-right">{t.feito}</th><th className="text-right">Desconto</th><th className="text-right">Juros</th><th className="px-2">Forma</th><th>Conta</th><th />
                  </tr>
                </thead>
                <tbody>
                  {historico.map((b, n) => (
                    <tr key={b.id ?? `n${n}`} className={cn("border-t border-line", b.nova && "bg-primary-light")}>
                      <td className="py-2 tabular-nums">{formatarData(b.data)}{b.nova && <span className="ml-1 text-[10px] uppercase text-primary">(a salvar)</span>}</td>
                      <td className="text-right tabular-nums">{formatarMoeda(b.valor)}</td>
                      <td className="text-right tabular-nums">{formatarMoeda(b.desconto)}</td>
                      <td className="text-right tabular-nums">{formatarMoeda(b.juros)}</td>
                      <td className="px-2 text-xs uppercase">{b.tipo_pagamento_nome ?? "—"}</td>
                      <td className="text-xs">{b.conta_corrente_nome ?? "—"}</td>
                      <td className="whitespace-nowrap text-right">
                        {lado === "receber" && !b.nova && (
                          <button type="button" onClick={() => setRecibo(true)} aria-label="Recibo" title="Recibo" className="inline-flex size-9 items-center justify-center rounded-xs bg-success text-surface-raised hover:opacity-90">
                            <IconFileInvoice size={18} aria-hidden />
                          </button>
                        )}
                        {podeSalvar && (
                          <button
                            type="button"
                            onClick={() => (b.nova ? setNovas((l) => l.filter((_, i) => i !== n - manter.length)) : setManter((l) => l.filter((x) => x.id !== b.id)))}
                            aria-label={`Remover ${t.verbo}`}
                            title={`Remover (vale ao salvar)`}
                            className="ml-1 inline-flex size-9 items-center justify-center rounded-xs bg-error text-surface-raised hover:opacity-90"
                          >
                            <IconX size={18} stroke={3} aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between bg-line px-4 py-3">
            <span className="text-lg uppercase text-ink-muted">Saldo a {lado === "receber" ? "receber" : "pagar"}</span>
            <span className="text-2xl font-bold tabular-nums text-ink">{formatarMoeda(saldo)}</span>
          </div>
        </div>

        {/* ---- Faixa do status + Efetuar recebimento/pagamento ---- */}
        <aside className="self-start">
          {/* Status curto grande (RECEBIDO); com "/ parcialmente recebido" a fonte diminui para caber na faixa. */}
          <div className={cn("flex min-h-24 items-center justify-center px-4 text-center font-bold uppercase leading-tight", status.rotulo.length > 14 ? "text-2xl" : "text-4xl md:text-5xl", status.faixa)}>{status.rotulo}</div>
          <div className="space-y-3 bg-ink/90 p-5 text-surface-raised">
            <p className="border-b border-surface-raised/30 pb-2 text-lg uppercase text-surface-raised/70">{t.acao}</p>
            {saldo < 0.009 && !novo ? (
              <p className="py-6 text-center text-sm text-surface-raised/80">Conta {lado === "receber" ? "recebida" : "paga"}. Para refazer, remova o {t.verbo} no histórico (X) e salve.</p>
            ) : (
              <fieldset disabled={!podeSalvar} className="space-y-3">
                <textarea aria-label="Observação" placeholder="Observação" value={painel.observacao} onChange={(e) => setPainel((p) => ({ ...p, observacao: e.target.value }))} rows={2} className={cn(campoPainel, "h-auto py-2 text-left md:h-auto")} />
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Data do {t.verbo}</span>
                  <input type="date" value={painel.data} onChange={(e) => setPainel((p) => ({ ...p, data: e.target.value }))} className={campoPainel} />
                </label>
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Conta corrente *</span>
                  <select value={painel.conta_corrente} onChange={(e) => setPainel((p) => ({ ...p, conta_corrente: e.target.value ? Number(e.target.value) : "" }))} className={cn(campoPainel, "text-left")}>
                    <option value="">Selecione</option>
                    {contas.map((c) => <option key={c.id} value={c.id} className="text-ink">{c.nome}</option>)}
                  </select>
                </label>
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Juros (+)</span>
                  <CampoNumero value={painel.juros} prefixo="R$ " onChange={(v) => setPainel((p) => ({ ...p, juros: v, valor: null }))} className={campoPainel} />
                </label>
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Descontos (−)</span>
                  <CampoNumero value={painel.desconto} prefixo="R$ " onChange={(v) => setPainel((p) => ({ ...p, desconto: v, valor: null }))} className={campoPainel} />
                </label>
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Valor {lado === "receber" ? "recebido" : "pago"} (=)</span>
                  <CampoNumero value={valorPainel} prefixo="R$ " onChange={(v) => setPainel((p) => ({ ...p, valor: v }))} className={cn(campoPainel, "font-bold")} />
                </label>
                <label className="grid grid-cols-[1fr_170px] items-center gap-2">
                  <span className={rotuloPainel}>Efetuado em</span>
                  <select value={painel.tipo_pagamento} onChange={(e) => setPainel((p) => ({ ...p, tipo_pagamento: e.target.value ? Number(e.target.value) : "" }))} className={cn(campoPainel, "text-left")}>
                    <option value="">—</option>
                    {tipos.map((x) => <option key={x.id} value={x.id} className="text-ink">{x.descricao}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => incluir()} className={cn(botaoConfirmar, "w-full")}>
                  Incluir {t.verbo}
                </button>
                <p className="text-xs text-surface-raised/70">O {t.verbo} entra no histórico e só é gravado ao clicar em Salvar.</p>
              </fieldset>
            )}
          </div>
        </aside>

        <div className="md:col-span-2">
          <BarraAcoes
            voltar={t.rota}
            aviso={aviso}
            erro={!!Object.keys(erros).length || /inválido|Informe|maior/.test(aviso)}
            podeSalvar={podeSalvar}
            salvando={salvando}
            onSalvarEVoltar={salvar(true)}
            extras={
              !novo && dados.manual && pode(t.rota, "excluir") ? (
                <button type="button" onClick={() => setExcluir(true)} className="min-h-12 rounded-xs bg-error px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
                  Cancelar
                </button>
              ) : origem ? (
                <Link to={origem} className="inline-flex min-h-12 items-center rounded-xs bg-ink px-4 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
                  Ver origem
                </Link>
              ) : null
            }
          />
        </div>
      </form>

      {juros && (
        <ConfirmDialog
          title="Aviso"
          message={`${t.verbo.charAt(0).toUpperCase() + t.verbo.slice(1)} maior que o saldo da conta. Deseja informar a diferença (${formatarMoeda(juros.diferenca)}) como juros?`}
          confirmLabel="Sim, como juros"
          neutro
          onCancel={() => setJuros(null)}
          onConfirm={() => {
            setJuros(null);
            incluir(true);
          }}
        />
      )}
      {excluir && (
        <ConfirmDialog
          title="Cancelar conta"
          message={`Deseja realmente excluir esta conta (${formatarMoeda(dados.valor)})? Os ${t.verbo}s dela também saem do caixa.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(false)}
          onConfirm={async () => {
            setExcluir(false);
            try {
              await api(`${t.api}/${id}`, { method: "DELETE" });
              navigate(t.rota);
            } catch (e) {
              setAviso(e instanceof ApiError ? e.message : "Não foi possível excluir.");
            }
          }}
        />
      )}
      {recibo && !novo && <ReciboModal contaId={Number(id)} onFechar={() => setRecibo(false)} />}
    </>
  );
}

type Beneficiario = { tipo: "fornecedor" | "cliente" | "funcionario"; id: number; nome: string };
const ROTULO_BENEFICIARIO = { fornecedor: "FORNECEDOR", cliente: "CLIENTE", funcionario: "FUNCIONÁRIO" } as const;

/** Beneficiário da conta a pagar (MarketUP): busca de fornecedor, cliente ou funcionário pelo nome (a partir da 3ª letra). */
function BuscaBeneficiario({ nome, disabled, onEscolher }: { nome: string; disabled: boolean; onEscolher: (b: Beneficiario | null) => void }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<Beneficiario[]>([]);
  const [editando, setEditando] = useState(!nome);
  useEffect(() => {
    if (nome) setEditando(false);
  }, [nome]);
  useEffect(() => {
    const q = termo.trim();
    if (q.length < 3) return setLista([]);
    const busca = (recurso: string, tipo: Beneficiario["tipo"]) =>
      api<{ results: { id: number; nome: string }[] }>(`/${recurso}?search=${encodeURIComponent(q)}&page_size=8`).then(
        (r) => r.results.map((x) => ({ tipo, id: x.id, nome: x.nome })),
        () => [] as Beneficiario[],
      );
    const h = window.setTimeout(() => {
      Promise.all([busca("fornecedores", "fornecedor"), busca("clientes", "cliente"), busca("funcionarios", "funcionario")]).then((r) => setLista(r.flat()));
    }, 300);
    return () => window.clearTimeout(h);
  }, [termo]);
  return (
    <div className="relative">
      <span className={rotulo}>Beneficiário</span>
      {nome && !editando ? (
        <p className="flex min-h-12 items-center gap-2 rounded-xs border border-line bg-surface px-3 text-sm md:min-h-[34px]">
          {nome}
          {!disabled && <button type="button" onClick={() => { setEditando(true); onEscolher(null); }} className="ml-auto text-xs font-semibold uppercase text-ink-muted hover:text-ink">trocar</button>}
        </p>
      ) : (
        <input aria-label="Buscar beneficiário" placeholder="Nome do fornecedor, cliente ou funcionário" value={termo} disabled={disabled} onChange={(e) => setTermo(e.target.value)} className={campo} />
      )}
      {lista.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised shadow-lg">
          {lista.map((b) => (
            <li key={`${b.tipo}-${b.id}`}>
              <button type="button" onClick={() => { onEscolher(b); setEditando(false); setTermo(""); setLista([]); }} className="min-h-12 w-full px-3 py-2 text-left text-sm hover:bg-primary-light">
                <span className="mr-2 text-[10px] font-bold text-ink-muted">{ROTULO_BENEFICIARIO[b.tipo]}</span>{b.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sacado da conta a receber: busca de cliente pelo nome (a partir da 3ª letra). */
function BuscaSacado({ nome, disabled, onEscolher }: { nome: string; disabled: boolean; onEscolher: (cliente: number | null, nome: string) => void }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<{ id: number; nome: string }[]>([]);
  const [editando, setEditando] = useState(!nome);
  // O nome chega depois de carregar a conta: sai do modo de busca quando ele aparece.
  useEffect(() => {
    if (nome) setEditando(false);
  }, [nome]);
  useEffect(() => {
    if (termo.trim().length < 3) return setLista([]);
    const h = window.setTimeout(() => api<{ results: { id: number; nome: string }[] }>(`/clientes?search=${encodeURIComponent(termo.trim())}&page_size=10`).then((r) => setLista(r.results), () => setLista([])), 300);
    return () => window.clearTimeout(h);
  }, [termo]);
  return (
    <div className="relative">
      <span className={rotulo}>Sacado (cliente)</span>
      {nome && !editando ? (
        <p className="flex min-h-12 items-center gap-2 rounded-xs border border-line bg-surface px-3 text-sm md:min-h-[34px]">
          CLIENTE: {nome}
          {!disabled && <button type="button" onClick={() => { setEditando(true); onEscolher(null, ""); }} className="ml-auto text-xs font-semibold uppercase text-ink-muted hover:text-ink">trocar</button>}
        </p>
      ) : (
        <input aria-label="Buscar sacado" placeholder="Nome do cliente" value={termo} disabled={disabled} onChange={(e) => setTermo(e.target.value)} className={campo} />
      )}
      {lista.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xs border border-line bg-surface-raised shadow-lg">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onEscolher(c.id, c.nome); setEditando(false); setTermo(""); setLista([]); }} className="min-h-12 w-full px-3 py-2 text-left text-sm hover:bg-primary-light">{c.nome}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

