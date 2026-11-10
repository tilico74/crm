import { IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { useMe } from "@/app/useMe";
import { FormSection, MaskedField, SelectField, SwitchField, TextField } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import { TabelaEditavel, type TabelaEditavelRef } from "@/components/TabelaEditavel";
import { api, ApiError } from "@/lib/api";
import { formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import { CampoNumero } from "@/components/CampoNumero";
import { BarraAcoes } from "@/resources/financeiro/BarraAcoes";

import { CampoLinha } from "./campo";
import { ROTA_PRODUTOS as ROTA } from "./ProdutosList";
import { margem, type Categoria, type ItemComposicao, type Marca, type Produto, type Unidade } from "./types";

type Dados = Omit<Produto, "id" | "imagem">;
type Erros = Record<string, string[] | string>;

const VAZIO: Dados = {
  ativo: true, codigo_barras: "", descricao: "", tipo_item: "produto", unidade: 1, codigo_balanca: "",
  categoria: null, subcategoria: null, marca: null, modelo: "", codigo_interno: "", tags: [],
  preco_custo: "0.00", preco_venda: "0.00", preco_atacado: "0.00", quantidade_minima_atacado: "0", reajustar_pela_margem: false,
  movimenta_estoque: false, movimenta_estoque_composicao: false, estoque_minimo: "0",
  fragmentacao_quantidade: null, fragmentacao_unidade: null, fragmentacao_preco: null,
  tipo_fiscal: "", ncm: "", origem: null, cest: "", classificacao: "comum", composicao: [],
};

// Listas fiscais da MarketUP (mesmos valores do back-end, apps/catalogo/models.py).
const TIPOS_ITEM = [
  { value: "produto", label: "Produto" }, { value: "kit", label: "Kit" }, { value: "insumo", label: "Insumo" }, { value: "brinde", label: "Brinde" },
];
const TIPOS_FISCAIS = [
  ["ativo_imobilizado", "Ativo imobilizado"], ["embalagem", "Embalagem"], ["uso_consumo", "Material de uso e consumo"],
  ["materia_prima", "Matéria-prima"], ["revenda", "Mercadoria para revenda"], ["outras", "Outras"], ["outros_insumos", "Outros insumos"],
  ["acabado", "Produto acabado"], ["em_processo", "Produto em processo"], ["intermediario", "Produto intermediário"],
  ["servicos", "Serviços"], ["subproduto", "Subproduto"],
].map(([value, label]) => ({ value, label }));
const ORIGENS = [
  "Nacional, exceto as indicadas nos códigos 3 a 5",
  "Estrangeira – Importação direta, exceto a indicada no código 6",
  "Estrangeira – Adquirida no mercado interno, exceto a indicada no código 7",
  "Nacional, mercadoria ou bem com conteúdo de importação superior a 40%",
  "Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos",
  "Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%",
  "Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CAMEX",
  "Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX",
  "Nacional, Conteúdo de Importação superior a 70%",
].map((texto, i) => ({ value: i, label: `${i} - ${texto}` }));
const CLASSIFICACOES = [
  { value: "comum", label: "Comum" }, { value: "medicamentos", label: "Medicamentos" }, { value: "armamentos", label: "Armamentos" },
  { value: "combustiveis", label: "Combustíveis" }, { value: "veiculos_novos", label: "Veículos novos" },
];
const ABAS = ["Estoque", "Fiscal", "Composição", "Fragmentação"] as const;

/** Ficha do produto no modelo da MarketUP (sem PDV, loja virtual, grade e fragmentação). */
export function ProdutoForm() {
  const { id } = useParams();
  const editando = id !== undefined && id !== "novo";
  const navigate = useNavigate();
  const { pode } = useMe();
  const podeSalvar = pode(ROTA, editando ? "alterar" : "adicionar");

  const [dados, setDados] = useState<Dados>(VAZIO);
  const [imagem, setImagem] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(editando);
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Estoque");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const arquivo = useRef<HTMLInputElement>(null);
  const tabelaComposicao = useRef<TabelaEditavelRef>(null);

  useEffect(() => {
    api<Unidade[]>("/unidades").then(setUnidades, () => undefined);
    api<Marca[]>("/marcas").then(setMarcas, () => undefined);
    api<{ results: Categoria[] }>("/categorias?page_size=500").then((r) => setCategorias(r.results), () => undefined);
    api<{ results: Produto[] }>("/produtos?page_size=500&ordering=descricao").then((r) => setProdutos(r.results), () => undefined);
    if (!editando) return;
    api<Produto>(`/produtos/${id}`).then(
      (p) => {
        const { id: _id, imagem: foto, ...resto } = p;
        setDados({
          ...VAZIO,
          ...resto,
          // "50.000" da API vira "50" na tela.
          fragmentacao_quantidade: resto.fragmentacao_quantidade === null ? null : String(Number(resto.fragmentacao_quantidade)),
          quantidade_minima_atacado: String(Number(resto.quantidade_minima_atacado)),
          composicao: resto.composicao.map((c, i) => ({ ...c, id: i + 1, quantidade: String(Number(c.quantidade)) })),
        });
        setImagem(foto);
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
    return Array.isArray(e) ? e.join(" ") : e;
  };
  const texto = (k: keyof Dados) => ({
    value: (dados[k] as string) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    error: erro(k),
    disabled: !podeSalvar,
  });
  const numero = (k: "preco_custo" | "preco_venda" | "preco_atacado" | "quantidade_minima_atacado", casas = "0.01") => ({
    type: "number",
    min: 0,
    step: casas,
    inputMode: "decimal" as const,
    className: "text-right tabular-nums",
    ...texto(k),
  });

  const unidadeKg = unidades.find((u) => u.id === dados.unidade)?.sigla === "KG";
  const subcategorias = categorias.find((c) => c.id === dados.categoria)?.subcategorias ?? [];

  const salvar = (voltar: boolean) => async (e?: FormEvent) => {
    e?.preventDefault();
    setSalvando(true);
    setErros({});
    setAviso("");
    const corpo = {
      ...dados,
      codigo_balanca: unidadeKg ? dados.codigo_balanca : "",
      composicao: dados.composicao.filter((c) => c.item).map((c) => ({ item: c.item, quantidade: c.quantidade, unidade: c.unidade })),
    };
    try {
      const salvo = await api<Produto>(editando ? `/produtos/${id}` : "/produtos", { method: editando ? "PUT" : "POST", body: JSON.stringify(corpo) });
      if (voltar) navigate(ROTA);
      else if (!editando) navigate(`${ROTA}/${salvo.id}`, { replace: true });
      else setAviso("Produto salvo.");
    } catch (falha) {
      if (falha instanceof ApiError) {
        setErros(falha.errors);
        setAviso(falha.message);
        // Erro fiscal fica escondido na aba: abre a aba certa.
        if (["ncm", "cest", "origem", "tipo_fiscal"].some((k) => k in falha.errors)) setAba("Fiscal");
        else if ("composicao" in falha.errors) setAba("Composição");
        else if (Object.keys(falha.errors).some((k) => k.startsWith("fragmentacao_"))) setAba("Fragmentação");
      }
    } finally {
      setSalvando(false);
    }
  };

  const enviarFoto = async (file: File | undefined) => {
    if (!file || !editando) return;
    const corpo = new FormData();
    corpo.append("arquivo", file);
    try {
      setImagem((await api<Produto>(`/produtos/${id}/imagem`, { method: "POST", body: corpo })).imagem);
    } catch (falha) {
      if (falha instanceof ApiError) setAviso(String((falha.errors.arquivo as string[] | undefined)?.join(" ") ?? falha.message));
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  };

  if (carregando) return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted">Carregando…</p>;

  const margemVarejo = margem(dados.preco_custo, dados.preco_venda);
  const margemAtacado = margem(dados.preco_custo, dados.preco_atacado);
  const custoComposicao = dados.composicao.reduce((total, c) => total + Number(c.quantidade || 0) * Number(c.item_custo || 0), 0);

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Produtos" />

      <form onSubmit={salvar(false)} noValidate className="mx-auto max-w-[992px] px-4 pb-28 pt-8 xl:px-0">
        <div className="flex flex-col gap-7 lg:flex-row">
          {/* Coluna da esquerda: código de barras, foto e situação, como na MarketUP. */}
          <div className="flex w-full shrink-0 flex-col border border-secondary lg:w-[164px]">
            <div className="p-2">
              <TextField label="Código de barras" inputMode="numeric" className="text-center font-mono text-base tabular-nums" {...texto("codigo_barras")} />
            </div>
            <div className="flex h-36 items-center justify-center bg-white">
              {imagem ? <img src={imagem} alt={`Foto de ${dados.descricao}`} className="max-h-full max-w-full object-contain" /> : <IconPhoto size={48} stroke={1} aria-label="Sem foto" className="text-secondary-light" />}
            </div>
            {podeSalvar && editando && (
              <div className="flex border-t border-line">
                <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" id="foto-produto" onChange={(e) => enviarFoto(e.target.files?.[0])} />
                <label htmlFor="foto-produto" className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1 text-xs font-semibold uppercase text-primary hover:bg-primary-light">
                  <IconUpload size={16} aria-hidden /> Foto
                </label>
                {imagem && (
                  <button type="button" aria-label="Remover foto" onClick={async () => setImagem((await api<Produto>(`/produtos/${id}/imagem`, { method: "DELETE" })).imagem)} className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft">
                    <IconTrash size={16} aria-hidden />
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2" role="group" aria-label="Situação">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={dados.ativo === v}
                  disabled={!podeSalvar}
                  onClick={() => set("ativo", v)}
                  className={cn("min-h-12 text-xs font-bold uppercase", dados.ativo === v ? "bg-primary text-primary-foreground" : "bg-line text-ink-muted hover:bg-primary-light")}
                >
                  {v ? "Ativo" : "Inativo"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 content-start gap-x-7 gap-y-4 sm:grid-cols-3">
            <h2 className="border-b border-secondary pb-2 text-lg font-semibold uppercase text-ink sm:col-span-3">Produto</h2>
            <TextField label="Descrição" required span={3} {...texto("descricao")} />
            <SelectField label="Tipo de item" value={dados.tipo_item} onChange={(e) => set("tipo_item", e.target.value as Dados["tipo_item"])} options={TIPOS_ITEM} disabled={!podeSalvar} />
            <SelectField label="Unidade" required value={dados.unidade ?? ""} onChange={(e) => set("unidade", e.target.value ? Number(e.target.value) : null)} options={unidades.map((u) => ({ value: u.id!, label: u.nome }))} error={erro("unidade")} disabled={!podeSalvar} />
            <TextField label="Código de balança" {...texto("codigo_balanca")} disabled={!podeSalvar || !unidadeKg} placeholder={unidadeKg ? "" : "Só para unidade em KG"} />
            <SelectField
              label="Categoria"
              value={dados.categoria ?? ""}
              onChange={(e) => setDados((d) => ({ ...d, categoria: e.target.value ? Number(e.target.value) : null, subcategoria: null }))}
              options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              disabled={!podeSalvar}
            />
            <SelectField
              label="Subcategoria"
              value={dados.subcategoria ?? ""}
              onChange={(e) => set("subcategoria", e.target.value ? Number(e.target.value) : null)}
              options={subcategorias.map((s) => ({ value: s.id!, label: s.nome }))}
              error={erro("subcategoria")}
              disabled={!podeSalvar || !subcategorias.length}
            />
            <div className="hidden sm:block" />
            <SelectField label="Marca" value={dados.marca ?? ""} onChange={(e) => set("marca", e.target.value ? Number(e.target.value) : null)} options={marcas.map((m) => ({ value: m.id!, label: m.nome }))} disabled={!podeSalvar} />
            <TextField label="Modelo" {...texto("modelo")} />
            <TextField label="Código interno" {...texto("codigo_interno")} />
            <Tags valor={dados.tags} onChange={(t) => set("tags", t)} disabled={!podeSalvar} />
          </div>
        </div>

        <div className="mt-10">
          <FormSection title="Preços">
            <TextField label="Custo (última compra) R$" {...numero("preco_custo")} />
            <TextField label="Venda varejo R$" {...numero("preco_venda")} />
            <Margem rotulo="Margem de lucro (aproximada no varejo)" valor={margemVarejo} />
            <div className="hidden lg:block" />
            <TextField label="Qtde mínima p/ atacado" {...numero("quantidade_minima_atacado", "0.001")} />
            <TextField label="Venda atacado R$" {...numero("preco_atacado")} />
            <Margem rotulo="Margem de lucro (aproximada no atacado)" valor={margemAtacado} />
            <div className="sm:col-span-2 lg:col-span-4">
              <SwitchField label="Reajustar preço de venda pela margem de lucro" checked={dados.reajustar_pela_margem} onChange={(v) => podeSalvar && set("reajustar_pela_margem", v)} />
              <p className="text-xs text-ink-muted">O sistema recalcula o preço de venda quando o custo mudar. A margem é sobre o preço de venda: Venda = Custo ÷ (1 − Margem).</p>
            </div>
          </FormSection>
        </div>

        <h2 className="mb-3 mt-10 text-2xl font-normal uppercase text-primary md:text-[30px]">Características</h2>
        <div role="tablist" aria-label="Características" className="grid grid-cols-2 sm:grid-cols-4">
          {ABAS.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={cn("min-h-12 text-sm font-bold uppercase", aba === a ? "bg-primary text-primary-foreground" : "bg-secondary text-surface-raised hover:opacity-90")}
            >
              {a}
              {a === "Fiscal" && !dados.ncm && <span className="ml-1 text-warning" aria-label="sem NCM">●</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={aba} className="border border-t-0 border-secondary p-4">
          {aba === "Estoque" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <SwitchField label="Movimentar estoque" checked={dados.movimenta_estoque} onChange={(v) => podeSalvar && set("movimenta_estoque", v)} />
                <p className="text-xs text-ink-muted">O estoque deste produto muda sozinho a cada compra ou venda.</p>
              </div>
              <div>
                <SwitchField label="Movimentar estoque da composição" checked={dados.movimenta_estoque_composicao} onChange={(v) => podeSalvar && set("movimenta_estoque_composicao", v)} />
                <p className="text-xs text-ink-muted">O estoque dos itens do kit muda a cada venda.</p>
              </div>
              <label className="block sm:w-1/2">
                <span className="mb-1 block font-label text-sm text-ink-muted">Estoque mínimo</span>
                <CampoNumero
                  casas={3}
                  value={dados.estoque_minimo ?? "0"}
                  disabled={!podeSalvar}
                  onChange={(v) => set("estoque_minimo", v)}
                  className="h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-right text-base tabular-nums text-ink focus:border-brand-cyan focus:outline-none md:h-[34px] md:text-sm"
                />
                <span className="text-xs text-ink-muted">Abaixo disso, a Consulta de estoque destaca o item.</span>
              </label>
            </div>
          )}
          {aba === "Fiscal" && (
            <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField label="Tipo" value={dados.tipo_fiscal} onChange={(e) => set("tipo_fiscal", e.target.value)} options={TIPOS_FISCAIS} error={erro("tipo_fiscal")} disabled={!podeSalvar} />
              <MaskedField label="NCM" mascara="ncm" value={dados.ncm} onChange={(v) => set("ncm", v)} error={erro("ncm")} disabled={!podeSalvar} />
              <SelectField label="Origem" span={2} value={dados.origem ?? ""} onChange={(e) => set("origem", e.target.value === "" ? null : Number(e.target.value))} options={ORIGENS} error={erro("origem")} disabled={!podeSalvar} />
              <MaskedField label="CEST" mascara="cest" value={dados.cest} onChange={(v) => set("cest", v)} error={erro("cest")} disabled={!podeSalvar} />
              <SelectField label="Classificação" value={dados.classificacao} onChange={(e) => set("classificacao", e.target.value)} options={CLASSIFICACOES} disabled={!podeSalvar} />
              {!dados.ncm && <p className="self-end text-sm font-semibold text-warning-ink sm:col-span-2">Sem NCM este produto não pode sair em nota fiscal.</p>}
            </div>
          )}
          {aba === "Fragmentação" && (
            <Fragmentacao
              unidadeProduto={unidades.find((u) => u.id === dados.unidade)?.nome ?? "Unidade"}
              unidades={unidades}
              quantidade={dados.fragmentacao_quantidade}
              unidade={dados.fragmentacao_unidade}
              preco={dados.fragmentacao_preco}
              erro={erro}
              disabled={!podeSalvar}
              onChange={(parcial) => {
                setDados((d) => ({ ...d, ...parcial }));
                // Corrigiu: some o aviso daquele campo.
                setErros((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in parcial))));
              }}
            />
          )}
          {aba === "Composição" && (
            <div className="-mx-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4">
                <p className="text-sm text-ink-muted">
                  Itens do kit. Custo total da composição: <strong className="text-ink">{formatarMoeda(custoComposicao)}</strong>
                </p>
                {podeSalvar && (
                  <button type="button" onClick={() => tabelaComposicao.current?.adicionar()} className="min-h-12 rounded-xs bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark">
                    Incluir item
                  </button>
                )}
              </div>
              <TabelaEditavel<ItemComposicao>
                ref={tabelaComposicao}
                linhas={dados.composicao}
                nova={{ item: null, quantidade: "1", unidade: null }}
                descrever={(c) => `Item ${c.item_descricao ?? ""}`.trim()}
                podeEditar={() => podeSalvar}
                podeExcluir={() => podeSalvar}
                avisarAoSalvar={false}
                onSalvar={async (c) => {
                  const produto = produtos.find((p) => p.id === c.item);
                  if (!produto) throw new ApiError(400, { item: ["Escolha o item."] });
                  if (produto.id === Number(id)) throw new ApiError(400, { item: ["Um kit não pode conter ele mesmo."] });
                  if (!(Number(c.quantidade) > 0)) throw new ApiError(400, { quantidade: ["Informe a quantidade."] });
                  const linha = {
                    ...c,
                    item_descricao: produto.descricao,
                    item_custo: produto.preco_custo,
                    unidade_sigla: unidades.find((u) => u.id === c.unidade)?.sigla ?? null,
                  };
                  setDados((d) => ({
                    ...d,
                    composicao: c.id ? d.composicao.map((x) => (x.id === c.id ? linha : x)) : [...d.composicao, { ...linha, id: Math.max(0, ...d.composicao.map((x) => x.id ?? 0)) + 1 }],
                  }));
                }}
                onExcluir={async (c) => setDados((d) => ({ ...d, composicao: d.composicao.filter((x) => x.id !== c.id) }))}
                colunas={[
                  {
                    cabecalho: "Item",
                    campo: "item",
                    exibir: (c) => c.item_descricao,
                    editar: (r, setR, e) => (
                      <>
                        <select aria-label="Item" autoFocus value={r.item ?? ""} onChange={(ev) => setR({ item: ev.target.value ? Number(ev.target.value) : null })} className="h-12 w-full rounded-xs border border-line bg-surface-raised px-2 text-base md:h-[34px] md:text-sm">
                          <option value="">Selecione o item</option>
                          {produtos.filter((p) => p.id !== Number(id)).map((p) => (
                            <option key={p.id} value={p.id}>{p.descricao}</option>
                          ))}
                        </select>
                        {e && <p className="mt-1 text-xs font-semibold normal-case text-error">{e}</p>}
                      </>
                    ),
                  },
                  {
                    cabecalho: "Quantidade",
                    campo: "quantidade",
                    classe: "w-28 tabular-nums",
                    exibir: (c) => Number(c.quantidade).toLocaleString("pt-BR"),
                    editar: (r, setR, e) => <CampoLinha rotulo="Quantidade" valor={r.quantidade} onChange={(v) => setR({ quantidade: v.replace(",", ".") })} erro={e} className="text-right" />,
                  },
                  {
                    cabecalho: "Unidade",
                    classe: "w-28",
                    exibir: (c) => c.unidade_sigla ?? "—",
                    editar: (r, setR) => (
                      <select aria-label="Unidade" value={r.unidade ?? ""} onChange={(ev) => setR({ unidade: ev.target.value ? Number(ev.target.value) : null })} className="h-12 w-full rounded-xs border border-line bg-surface-raised px-2 text-base md:h-[34px] md:text-sm">
                        <option value="">—</option>
                        {unidades.map((u) => (
                          <option key={u.id} value={u.id}>{u.sigla}</option>
                        ))}
                      </select>
                    ),
                  },
                  { cabecalho: "Custo unitário", classe: "w-32 tabular-nums", exibir: (c) => formatarMoeda(c.item_custo ?? 0) },
                  { cabecalho: "Custo total", classe: "w-32 tabular-nums", exibir: (c) => formatarMoeda(Number(c.quantidade || 0) * Number(c.item_custo || 0)) },
                ]}
                vazio={dados.tipo_item === "kit" ? 'Kit sem itens. Use "Incluir item".' : "Composição é usada em produtos do tipo Kit."}
              />
            </div>
          )}
        </div>

        <BarraAcoes voltar={ROTA} aviso={aviso} erro={!!Object.keys(erros).length} podeSalvar={podeSalvar} salvando={salvando} onSalvarEVoltar={salvar(true)} />
      </form>
    </>
  );
}

type FragmentacaoProps = {
  unidadeProduto: string;
  unidades: Unidade[];
  quantidade: string | null;
  unidade: number | null;
  preco: string | null;
  erro: (campo: string) => string | undefined;
  disabled: boolean;
  onChange: (parcial: Partial<Pick<Dados, "fragmentacao_quantidade" | "fragmentacao_unidade" | "fragmentacao_preco">>) => void;
};

/** Aba Fragmentação da MarketUP: "1 <unidade> = <quantidade> <unidade>" e o valor de venda de cada parte. */
function Fragmentacao({ unidadeProduto, unidades, quantidade, unidade, preco, erro, disabled, onChange }: FragmentacaoProps) {
  const ativa = !!(quantidade || unidade || preco);
  const parte = unidades.find((u) => u.id === unidade)?.nome;
  const passo = (delta: number) => onChange({ fragmentacao_quantidade: String(Math.max(0, Number(quantidade || 0) + delta)) });
  return (
    <div>
      <p className="text-sm">Para vender este produto fracionado, informe abaixo a condição de fragmentação.</p>
      <p className="text-xs text-ink-muted">Exemplos: 1 Rolo = 50 Metros · 1 Caixa = 10 Pacotes · 1 Cento = 100 Unidades.</p>

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <span className="pb-2 text-lg font-bold">1 {unidadeProduto} =</span>
        <div>
          <label htmlFor="frag-qtd" className="mb-1 block font-label text-sm text-ink-muted">Quantidade</label>
          <div className="flex">
            <button type="button" onClick={() => passo(-1)} disabled={disabled} aria-label="Diminuir quantidade" className="inline-flex size-12 items-center justify-center bg-secondary text-surface-raised [@media(pointer:fine)]:h-[34px] [@media(pointer:fine)]:w-9">−</button>
            <input
              id="frag-qtd"
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              value={quantidade ?? ""}
              onChange={(e) => onChange({ fragmentacao_quantidade: e.target.value || null })}
              aria-invalid={!!erro("fragmentacao_quantidade")}
              disabled={disabled}
              className="h-12 w-24 border-y border-line bg-surface-raised text-center text-base tabular-nums focus:outline-none aria-[invalid=true]:border-error md:text-sm [@media(pointer:fine)]:h-[34px]"
            />
            <button type="button" onClick={() => passo(1)} disabled={disabled} aria-label="Aumentar quantidade" className="inline-flex size-12 items-center justify-center bg-secondary text-surface-raised [@media(pointer:fine)]:h-[34px] [@media(pointer:fine)]:w-9">+</button>
          </div>
        </div>
        <div className="w-48">
          <SelectField
            label="Unidade"
            value={unidade ?? ""}
            onChange={(e) => onChange({ fragmentacao_unidade: e.target.value ? Number(e.target.value) : null })}
            options={unidades.map((u) => ({ value: u.id!, label: u.nome }))}
            error={erro("fragmentacao_unidade")}
            disabled={disabled}
          />
        </div>
        <div className="w-40">
          <TextField
            label="Valor de venda R$"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="text-right tabular-nums"
            value={preco ?? ""}
            onChange={(e) => onChange({ fragmentacao_preco: e.target.value || null })}
            error={erro("fragmentacao_preco")}
            disabled={disabled}
          />
        </div>
        {ativa && !disabled && (
          <button
            type="button"
            onClick={() => onChange({ fragmentacao_quantidade: null, fragmentacao_unidade: null, fragmentacao_preco: null })}
            className="min-h-12 px-2 text-xs font-semibold uppercase text-error hover:underline [@media(pointer:fine)]:min-h-[34px]"
          >
            Não fracionar
          </button>
        )}
      </div>

      {erro("fragmentacao_quantidade") && <p className="mt-2 text-xs font-semibold text-error">{erro("fragmentacao_quantidade")}</p>}

      <div className="mt-4 rounded-xs bg-surface px-4 py-3 text-sm">
        {ativa && quantidade && parte && preco ? (
          <>
            Cada {parte.toLowerCase()} será vendido(a) por <strong>{formatarMoeda(preco)}</strong>; 1 {unidadeProduto.toLowerCase()} rende {Number(quantidade).toLocaleString("pt-BR")} {parte.toLowerCase()}(s).
          </>
        ) : (
          "Este produto não é vendido fracionado."
        )}
        <span className="mt-1 block text-xs text-ink-muted">Estoque de consumo: aparece quando o módulo Estoque (T301) estiver pronto.</span>
      </div>
    </div>
  );
}

function Margem({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-end gap-2" aria-live="polite">
      <span className={cn("text-3xl font-bold tabular-nums", valor < 0 ? "text-error" : "text-success")}>
        {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
      </span>
      <span className="pb-1 text-xs uppercase text-ink-muted">{rotulo}</span>
    </div>
  );
}

/** Tags como na MarketUP: digite e tecle Enter (ou vírgula) para incluir; × remove. */
function Tags({ valor, onChange, disabled }: { valor: string[]; onChange: (t: string[]) => void; disabled?: boolean }) {
  const [texto, setTexto] = useState("");
  const incluir = () => {
    const t = texto.trim();
    if (t && !valor.includes(t)) onChange([...valor, t]);
    setTexto("");
  };
  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      incluir();
    } else if (e.key === "Backspace" && !texto && valor.length) {
      onChange(valor.slice(0, -1));
    }
  };
  return (
    <div className="sm:col-span-3">
      <label htmlFor="tags" className="mb-1 block font-label text-sm text-ink-muted">Tags</label>
      <div className="flex min-h-12 flex-wrap items-center gap-1 rounded-xs border border-line bg-surface-raised p-1 focus-within:border-brand-cyan [@media(pointer:fine)]:min-h-[34px]">
        {valor.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-xs bg-secondary px-2 py-1 text-xs font-semibold uppercase text-surface-raised">
            {t}
            {!disabled && (
              <button type="button" aria-label={`Remover tag ${t}`} onClick={() => onChange(valor.filter((x) => x !== t))} className="inline-flex size-6 items-center justify-center">
                <IconX size={14} aria-hidden />
              </button>
            )}
          </span>
        ))}
        <input id="tags" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} onBlur={incluir} disabled={disabled} placeholder="Adicione uma tag" className="min-w-32 flex-1 bg-transparent px-2 text-base text-ink focus:outline-none md:text-sm" />
      </div>
    </div>
  );
}
