import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { Field, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Produto, Servico } from "@/resources/catalogo/types";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { AbaLista } from "./AbaLista";
import { ROTA_LISTAS as ROTA } from "./ListasPrecosList";
import { formatarDesconto, type ItemListaPreco, type ListaPreco, type TipoValor } from "./types";

type Dados = Omit<ListaPreco, "id">;
type Linha = ItemListaPreco & { id?: number };

const VAZIO: Dados = { nome: "", desconto_varejo: "0.00", desconto_varejo_tipo: "R", desconto_atacado: "0.00", desconto_atacado_tipo: "R", itens: [] };
const ITEM_NOVO: Linha = { produto: null, servico: null, desconto_varejo: "0.00", desconto_varejo_tipo: "R", desconto_atacado: "0.00", desconto_atacado_tipo: "R" };

/** Ficha da lista de preços: descrição, descontos de varejo e atacado (R$ ou %) e itens com desconto diferenciado. */
export function ListaPrecoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(editando);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  useEffect(() => {
    api<{ results: Produto[] }>("/produtos?page_size=1000&ordering=descricao&ativo=true").then((r) => setProdutos(r.results), () => undefined);
    api<{ results: Servico[] }>("/servicos?page_size=1000&ordering=nome").then((r) => setServicos(r.results), () => undefined);
    if (!editando) return;
    api<ListaPreco>(`/listas-precos/${id}`).then(
      ({ id: _id, ...l }) => {
        setDados(l);
        setLinhas(l.itens.map((item, i) => ({ ...item, id: i + 1 })));
        setCarregando(false);
      },
      (e: ApiError) => {
        setAviso(e.message);
        setCarregando(false);
      },
    );
  }, [editando, id]);

  const erro = (k: string) => {
    const e = erros[k];
    return e ? (Array.isArray(e) ? e.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") : String(e)) : undefined;
  };
  const descricaoItem = (l: Linha) =>
    l.produto ? produtos.find((p) => p.id === l.produto)?.descricao : servicos.find((s) => s.id === l.servico)?.nome;

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = {
      ...dados,
      itens: linhas.map(({ id: _id, item_descricao: _d, ...l }) => l),
    };
    try {
      const salvo = await api<ListaPreco>(editando ? `/listas-precos/${id}` : "/listas-precos", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else setAviso("Lista de preços salva.");
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Lista de preços/Tipos de clientes" />
      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Descrição" required span={2} maxLength={300} value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} error={erro("nome")} disabled={!podeSalvar} />
          <Desconto
            rotulo="Desc. Varejo"
            valor={dados.desconto_varejo}
            tipo={dados.desconto_varejo_tipo}
            erro={erro("desconto_varejo")}
            disabled={!podeSalvar}
            onChange={(valor, tipo) => setDados((d) => ({ ...d, desconto_varejo: valor, desconto_varejo_tipo: tipo }))}
          />
          <Desconto
            rotulo="Desc. Atacado"
            valor={dados.desconto_atacado}
            tipo={dados.desconto_atacado_tipo}
            erro={erro("desconto_atacado")}
            disabled={!podeSalvar}
            onChange={(valor, tipo) => setDados((d) => ({ ...d, desconto_atacado: valor, desconto_atacado_tipo: tipo }))}
          />
        </div>

        <h2 className="mb-3 mt-10 border-b border-secondary pb-2 text-lg font-normal uppercase text-ink">Itens com desconto diferenciado</h2>
        {erro("itens") && <p role="alert" className="mb-3 text-sm font-semibold text-error">{erro("itens")}</p>}
        <div className="border border-line p-4">
          <AbaLista<Linha>
            nova={ITEM_NOVO}
            linhas={linhas}
            onChange={setLinhas}
            podeSalvar={podeSalvar}
            vazio="Nenhum item com desconto diferenciado foi cadastrado até o momento!"
            validar={(l) =>
              !l.produto && !l.servico
                ? "Escolha o item."
                : linhas.some((x) => x.id !== l.id && x.produto === l.produto && x.servico === l.servico)
                  ? "Este item já está na lista."
                  : null
            }
            campos={(l, setL) => (
              <>
                <Field label="Item" span={2}>
                  {(campoId) => (
                    <select
                      id={campoId}
                      value={l.produto ? `p${l.produto}` : l.servico ? `s${l.servico}` : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setL({ produto: v.startsWith("p") ? Number(v.slice(1)) : null, servico: v.startsWith("s") ? Number(v.slice(1)) : null });
                      }}
                      className="h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base md:text-sm [@media(pointer:fine)]:h-[34px]"
                    >
                      <option value="">Selecione</option>
                      <optgroup label="Produtos">
                        {produtos.map((p) => <option key={p.id} value={`p${p.id}`}>{p.descricao}</option>)}
                      </optgroup>
                      <optgroup label="Serviços">
                        {servicos.map((s) => <option key={s.id} value={`s${s.id}`}>{s.nome}</option>)}
                      </optgroup>
                    </select>
                  )}
                </Field>
                <Desconto rotulo="Desconto Varejo" valor={l.desconto_varejo} tipo={l.desconto_varejo_tipo} onChange={(valor, tipo) => setL({ desconto_varejo: valor, desconto_varejo_tipo: tipo })} />
                <Desconto rotulo="Desconto Atacado" valor={l.desconto_atacado} tipo={l.desconto_atacado_tipo} onChange={(valor, tipo) => setL({ desconto_atacado: valor, desconto_atacado_tipo: tipo })} />
              </>
            )}
            colunas={[
              { cabecalho: "Item", exibir: (l) => descricaoItem(l) ?? l.item_descricao ?? "—" },
              { cabecalho: "Desconto Varejo", exibir: (l) => formatarDesconto(l.desconto_varejo, l.desconto_varejo_tipo), classe: "tabular-nums w-36" },
              { cabecalho: "Desconto Atacado", exibir: (l) => formatarDesconto(l.desconto_atacado, l.desconto_atacado_tipo), classe: "tabular-nums w-36" },
            ]}
          />
        </div>

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}

/** Valor do desconto com os botões R$ / % da MarketUP. */
function Desconto({ rotulo, valor, tipo, onChange, erro, disabled }: {
  rotulo: string;
  valor: string;
  tipo: TipoValor;
  onChange: (valor: string, tipo: TipoValor) => void;
  erro?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={`${rotulo} (${tipo === "P" ? "%" : "R$"})`} error={erro}>
      {(campoId, describedBy) => (
        <div className="flex">
          <input
            id={campoId}
            type="number"
            min={0}
            max={tipo === "P" ? 100 : undefined}
            step="0.01"
            inputMode="decimal"
            value={valor}
            disabled={disabled}
            aria-invalid={!!erro}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value, tipo)}
            className="h-12 w-full min-w-0 rounded-l-xs border border-line bg-surface-raised px-3 text-right text-base tabular-nums aria-[invalid=true]:border-error md:text-sm [@media(pointer:fine)]:h-[34px]"
          />
          {(["R", "P"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              disabled={disabled}
              onClick={() => onChange(valor, t)}
              className={cn("min-h-12 w-10 text-xs font-bold [@media(pointer:fine)]:min-h-[34px]", tipo === t ? "bg-primary text-primary-foreground" : "bg-line text-ink-muted")}
            >
              {t === "R" ? "R$" : "%"}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
