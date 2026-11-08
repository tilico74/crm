import { useCreate, useOne, useUpdate, type HttpError } from "@refinedev/core";
import { IconCheck, IconCirclePlus, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

import { BarraAcoes } from "./BarraAcoes";
import { dataBr, decimalBr, simNao } from "./regras";
import { ROTA_TIPOS_PAGAMENTO as ROTA } from "./TiposPagamentoList";
import type { CondicaoPagamento, TipoPagamento } from "./types";

type Dados = Omit<TipoPagamento, "id">;
type Erros = Record<string, unknown>;

const VAZIO: Dados = { descricao: "", inicio_contrato: null, fim_contrato: null, carencia: 0, ativo: true, condicoes: [] };
const NOVA_CONDICAO: CondicaoPagamento = {
  descricao: "", parcelas: 1, intervalo: 0, primeira_parcela: 0, percentual_adm: "0.00", percentual_antecipacao: "0.00",
  valor_fixo: "0.00", classificacao: "", compras: true, vendas: true,
};

// Colunas da tabela de condições, na ordem da MarketUP, com a explicação de cada uma.
const COLUNAS = [
  { chave: "descricao", titulo: "Descrição", ajuda: "Nome da condição. Ex.: Entrada + 02x sem juros" },
  { chave: "parcelas", titulo: "Parcel.", ajuda: "Quantidade de parcelas (contando a entrada)" },
  { chave: "intervalo", titulo: "Interv.", ajuda: "Dias entre uma parcela e a próxima" },
  { chave: "primeira_parcela", titulo: "1ª parc.", ajuda: "Dias até a 1ª parcela (0 = no ato, com entrada)" },
  { chave: "percentual_adm", titulo: "% adm", ajuda: "Taxa de administração (ex.: da maquininha)" },
  { chave: "percentual_antecipacao", titulo: "% ant.", ajuda: "Taxa de antecipação de recebíveis" },
  { chave: "valor_fixo", titulo: "Vl fixo", ajuda: "Tarifa fixa por operação, em reais" },
  { chave: "classificacao", titulo: "Classif.", ajuda: "Classificação da condição" },
  { chave: "compras", titulo: "Compras?", ajuda: "Pode ser usada nas compras" },
  { chave: "vendas", titulo: "Vendas?", ajuda: "Pode ser usada nas vendas" },
] as const;

/** Ficha do tipo de pagamento com as condições de pagamento, como na MarketUP (sem "Utiliza no PDV?"). */
export function TipoPagamentoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");
  // Linha da tabela de condições em edição (índice) e o rascunho dela.
  const [linha, setLinha] = useState<{ indice: number; condicao: CondicaoPagamento } | null>(null);

  const { result: registro, query } = useOne<TipoPagamento>({ resource: "tipos-pagamento", id, queryOptions: { enabled: editando } });
  const { mutate: criar, mutation: criacao } = useCreate<TipoPagamento, HttpError, Dados>();
  const { mutate: atualizar, mutation: atualizacao } = useUpdate<TipoPagamento, HttpError, Dados>();

  useEffect(() => {
    if (registro) setDados({ ...VAZIO, ...registro });
  }, [registro]);

  const set = <K extends keyof Dados>(k: K, v: Dados[K]) => setDados((d) => ({ ...d, [k]: v }));
  const erroTexto = (k: string) => {
    const e = erros[k];
    return Array.isArray(e) ? e.join(" ") : typeof e === "string" ? e : undefined;
  };
  const errosCondicoes = (Array.isArray(erros.condicoes) ? erros.condicoes : []) as Record<string, string[]>[];

  const confirmarLinha = () => {
    if (!linha) return;
    if (!linha.condicao.descricao.trim()) return;
    const condicoes = [...dados.condicoes];
    if (linha.indice === condicoes.length) condicoes.push(linha.condicao);
    else condicoes[linha.indice] = linha.condicao;
    set("condicoes", condicoes);
    setLinha(null);
  };

  const salvar = (voltar: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    if (linha) confirmarLinha();
    setErros({});
    setAviso("");
    const corpo = { ...dados, inicio_contrato: dados.inicio_contrato || null, fim_contrato: dados.fim_contrato || null };
    const opcoes = {
      onSuccess: ({ data }: { data: TipoPagamento }) => {
        if (voltar) navigate(ROTA);
        else if (!editando) navigate(`${ROTA}/${data.id}`, { replace: true });
        else setAviso("Tipo de pagamento salvo.");
      },
      onError: (erro: HttpError) => {
        setErros(erro.errors ?? {});
        setAviso(erro.message);
      },
    };
    if (editando) atualizar({ resource: "tipos-pagamento", id: id!, values: corpo, successNotification: false, errorNotification: false }, opcoes);
    else criar({ resource: "tipos-pagamento", values: corpo, successNotification: false, errorNotification: false }, opcoes);
  };

  if (editando && query.isLoading) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Tipo de pagamento" />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_100px_auto]">
          <TextField label="Descrição" required value={dados.descricao} onChange={(e) => set("descricao", e.target.value)} error={erroTexto("descricao")} disabled={!podeSalvar} />
          <TextField label="Início contrato" type="date" value={dados.inicio_contrato ?? ""} onChange={(e) => set("inicio_contrato", e.target.value || null)} error={erroTexto("inicio_contrato")} disabled={!podeSalvar} />
          <TextField label="Fim contrato" type="date" value={dados.fim_contrato ?? ""} onChange={(e) => set("fim_contrato", e.target.value || null)} error={erroTexto("fim_contrato")} disabled={!podeSalvar} />
          <TextField label="Carência (dias)" type="number" min={0} inputMode="numeric" value={String(dados.carencia)} onChange={(e) => set("carencia", Number(e.target.value))} error={erroTexto("carencia")} disabled={!podeSalvar} />
          <SwitchField label="Ativo?" checked={dados.ativo} onChange={(v) => podeSalvar && set("ativo", v)} />
        </div>

        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-normal uppercase text-primary md:text-[30px]">Condições de pagamento</h2>
          {podeSalvar && (
            <button
              type="button"
              onClick={() => setLinha({ indice: dados.condicoes.length, condicao: { ...NOVA_CONDICAO } })}
              disabled={!!linha}
              className="inline-flex min-h-12 items-center gap-2 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
            >
              <IconCirclePlus size={20} aria-hidden />
              Incluir condição de pagamento
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm text-ink">
            <thead>
              <tr className="h-12 border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
                {COLUNAS.map((c) => (
                  <th key={c.chave} scope="col" title={c.ajuda} className={cn("px-1", c.chave !== "descricao" && "text-center")}>
                    {c.titulo}
                  </th>
                ))}
                <th scope="col" className="w-24"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {[...dados.condicoes, ...(linha && linha.indice === dados.condicoes.length ? [linha.condicao] : [])].map((c, i) =>
                linha?.indice === i ? (
                  <LinhaCondicao
                    key={i}
                    condicao={linha.condicao}
                    erros={errosCondicoes[i]}
                    onChange={(condicao) => setLinha({ indice: i, condicao })}
                    onConfirmar={confirmarLinha}
                    onCancelar={() => setLinha(null)}
                  />
                ) : (
                  <tr key={i} className={cn("h-12 border-b border-line uppercase even:bg-surface", errosCondicoes[i] && Object.keys(errosCondicoes[i]).length && "bg-error-soft")}>
                    <td className="px-1">{c.descricao}</td>
                    <td className="px-1 text-center tabular-nums">{c.parcelas}</td>
                    <td className="px-1 text-center tabular-nums">{c.intervalo}</td>
                    <td className="px-1 text-center tabular-nums">{c.primeira_parcela}</td>
                    <td className="px-1 text-center tabular-nums">{decimalBr(c.percentual_adm)}</td>
                    <td className="px-1 text-center tabular-nums">{decimalBr(c.percentual_antecipacao)}</td>
                    <td className="px-1 text-center tabular-nums">{decimalBr(c.valor_fixo)}</td>
                    <td className="px-1 text-center">{c.classificacao || "—"}</td>
                    <td className="px-1 text-center">{simNao(c.compras)}</td>
                    <td className="px-1 text-center">{simNao(c.vendas)}</td>
                    <td className="text-right">
                      {podeSalvar && (
                        <>
                          <button type="button" onClick={() => setLinha({ indice: i, condicao: { ...c } })} disabled={!!linha} aria-label={`Editar ${c.descricao}`} className="inline-flex size-12 items-center justify-center hover:text-primary disabled:opacity-40">
                            <IconPencil size={20} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => set("condicoes", dados.condicoes.filter((_, j) => j !== i))}
                            disabled={!!linha}
                            aria-label={`Remover ${c.descricao}`}
                            className="inline-flex size-12 items-center justify-center text-error hover:opacity-80 disabled:opacity-40"
                          >
                            <IconTrash size={20} aria-hidden />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        {!dados.condicoes.length && !linha && (
          <p className="py-6 text-ink-muted">Nenhuma condição. Use "Incluir condição de pagamento" (ex.: À vista, 1 parcela).</p>
        )}
        {editando && registro && <p className="mt-4 text-xs text-ink-muted">Contrato: {dataBr(dados.inicio_contrato)} a {dataBr(dados.fim_contrato)}. As condições removidas só saem ao salvar.</p>}

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={criacao.isPending || atualizacao.isPending} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}

type LinhaProps = {
  condicao: CondicaoPagamento;
  erros?: Record<string, string[]>;
  onChange: (c: CondicaoPagamento) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
};

const campo =
  "h-12 w-full min-w-0 rounded-xs border border-line bg-surface-raised px-2 text-base text-ink focus:border-brand-cyan focus:outline-none aria-[invalid=true]:border-error md:h-[34px] md:text-sm";

/** Linha da condição em edição. Enter confirma, Esc cancela (sem enviar o formulário). */
function LinhaCondicao({ condicao, erros, onChange, onConfirmar, onCancelar }: LinhaProps) {
  const set = <K extends keyof CondicaoPagamento>(k: K, v: CondicaoPagamento[K]) => onChange({ ...condicao, [k]: v });
  const numero = (k: "parcelas" | "intervalo" | "primeira_parcela", rotulo: string, min = 0) => (
    <input type="number" min={min} inputMode="numeric" aria-label={rotulo} value={condicao[k]} onChange={(e) => set(k, Number(e.target.value))} className={cn(campo, "text-center tabular-nums")} />
  );
  const decimal = (k: "percentual_adm" | "percentual_antecipacao" | "valor_fixo", rotulo: string) => (
    <input type="number" min={0} step="0.01" inputMode="decimal" aria-label={rotulo} aria-invalid={!!erros?.[k]} value={condicao[k]} onChange={(e) => set(k, e.target.value)} className={cn(campo, "text-center tabular-nums")} />
  );
  const marca = (k: "compras" | "vendas", rotulo: string) => (
    <label className="flex min-h-12 items-center justify-center md:min-h-0">
      <input type="checkbox" checked={condicao[k]} onChange={(e) => set(k, e.target.checked)} aria-label={rotulo} className="size-5 accent-primary" />
    </label>
  );
  const teclas = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirmar();
    } else if (e.key === "Escape") {
      onCancelar();
    }
  };

  return (
    <tr onKeyDown={teclas} className="border-b-2 border-primary bg-primary-light/40">
      <td className="px-1 py-2">
        <input autoFocus aria-label="Descrição da condição" aria-invalid={!condicao.descricao.trim()} value={condicao.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: À vista" className={campo} />
      </td>
      <td className="w-16 px-1">{numero("parcelas", "Parcelas", 1)}</td>
      <td className="w-16 px-1">{numero("intervalo", "Intervalo em dias")}</td>
      <td className="w-16 px-1">{numero("primeira_parcela", "Dias até a 1ª parcela")}</td>
      <td className="w-20 px-1">{decimal("percentual_adm", "% de administração")}</td>
      <td className="w-20 px-1">{decimal("percentual_antecipacao", "% de antecipação")}</td>
      <td className="w-20 px-1">{decimal("valor_fixo", "Valor fixo em reais")}</td>
      <td className="w-20 px-1">
        <input aria-label="Classificação" value={condicao.classificacao} onChange={(e) => set("classificacao", e.target.value)} className={campo} />
      </td>
      <td className="px-1">{marca("compras", "Usar nas compras")}</td>
      <td className="px-1">{marca("vendas", "Usar nas vendas")}</td>
      <td className="text-right">
        <button type="button" onClick={onConfirmar} disabled={!condicao.descricao.trim()} aria-label="Confirmar condição" title="Confirmar (Enter)" className="inline-flex size-12 items-center justify-center text-success hover:bg-success-soft disabled:opacity-40">
          <IconCheck size={22} aria-hidden />
        </button>
        <button type="button" onClick={onCancelar} aria-label="Cancelar" title="Cancelar (Esc)" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft">
          <IconX size={22} aria-hidden />
        </button>
      </td>
    </tr>
  );
}
