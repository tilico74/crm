import { IconCheck, IconChevronDown, IconChevronRight, IconPencil, IconX } from "@tabler/icons-react";
import { Fragment, useCallback, useEffect, useState } from "react";

import { useMe } from "@/app/useMe";
import { CampoNumero } from "@/components/CampoNumero";
import { PageHeader } from "@/components/PageHeader";
import { api, ApiError } from "@/lib/api";
import { formatarMoeda } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { ROTA_ESTOQUE } from "./types";

type LocalQtd = { local: number; local_nome: string; quantidade: string; valor_total: string };
type Linha = {
  produto: number; codigo: string; descricao: string; unidade: string; quantidade: string; estoque_minimo: string; abaixo_minimo: boolean;
  preco: string; valor_unitario: string; valor_total: string; locais: LocalQtd[];
};

const num = (v: string | number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Estoque › Consulta de estoque (stock_query da MarketUP): Item · Qtd. disponível · Estoque mín. · Preço · Valor unitário (custo)
 * · Valor total; cada item abre por local, e a quantidade do local pode ser editada (vira um acerto).
 */
export function ConsultaEstoque() {
  const { pode } = useMe();
  const [termo, setTermo] = useState("");
  const [abaixo, setAbaixo] = useState(false);
  const [dados, setDados] = useState<{ count: number; valor_total: string; results: Linha[] } | null>(null);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [editando, setEditando] = useState<{ produto: number; local: number; valor: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const podeAjustar = pode(ROTA_ESTOQUE.consulta, "alterar");

  const carregar = useCallback(() => {
    const q = new URLSearchParams();
    if (termo) q.set("search", termo);
    if (abaixo) q.set("abaixo_minimo", "1");
    api<typeof dados>(`/consulta-estoque?${q}`).then(setDados, (e: ApiError) => setAviso(e.message));
  }, [termo, abaixo]);
  useEffect(() => {
    const t = window.setTimeout(carregar, 250);
    return () => window.clearTimeout(t);
  }, [carregar]);

  const salvar = async () => {
    if (!editando) return;
    try {
      await api("/consulta-estoque", { method: "PATCH", body: JSON.stringify({ produto: editando.produto, local: editando.local, quantidade: editando.valor }) });
      setEditando(null);
      setAviso("");
      carregar();
    } catch (e) {
      setAviso(e instanceof ApiError ? e.message : "Não foi possível ajustar.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Estoque" title="Consulta de estoque" />
      <div className="mx-auto mt-4 flex max-w-[992px] flex-wrap items-end gap-3 px-4 xl:px-0">
        <label className="flex flex-1 flex-col text-sm text-ink-muted">
          <span className="mb-1 font-label">Localizar por</span>
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome ou código do item" className="h-12 rounded-xs border border-line bg-surface-raised px-3 md:h-[34px]" />
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm md:min-h-[34px]">
          <input type="checkbox" checked={abaixo} onChange={(e) => setAbaixo(e.target.checked)} className="size-5 accent-primary" />
          Só abaixo do estoque mínimo
        </label>
      </div>
      {aviso && <p role="alert" className="mx-auto mt-4 max-w-[992px] rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">{aviso}</p>}
      <div className="mx-auto max-w-[992px] overflow-x-auto px-4 pb-16 pt-4 xl:px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="h-[60px] border-b border-line text-left text-xs font-bold uppercase text-primary-dark">
              <th className="w-8" /><th>Item</th><th className="text-right">Qtd. disponível</th><th className="text-right">Estoque mín.</th><th className="text-right">Preço</th><th className="text-right">Valor unitário</th><th className="text-right">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {dados?.results.map((l) => {
              const aberto = abertos.has(l.produto);
              return (
                <Fragment key={l.produto}>
                  <tr className="cursor-pointer border-b border-line hover:bg-surface" onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(l.produto)) n.delete(l.produto); else n.add(l.produto); return n; })}>
                    <td className="text-ink-muted">{aberto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}</td>
                    <td className="py-3"><span className="block text-[11px] tabular-nums text-ink-muted">{l.codigo || "sem código"}</span>{l.descricao}</td>
                    <td className={cn("text-right font-semibold tabular-nums", l.abaixo_minimo ? "text-error" : "text-ink")}>{num(l.quantidade)} <span className="text-xs font-normal">{l.unidade}</span></td>
                    <td className="text-right tabular-nums text-ink-muted">{num(l.estoque_minimo)}</td>
                    <td className="text-right tabular-nums">{formatarMoeda(l.preco)}</td>
                    <td className="text-right tabular-nums">{formatarMoeda(l.valor_unitario)}</td>
                    <td className="text-right tabular-nums">{formatarMoeda(l.valor_total)}</td>
                  </tr>
                  {aberto && (
                    <tr className="bg-surface">
                      <td />
                      <td colSpan={6} className="py-2">
                        <table className="w-full text-xs">
                          <thead><tr className="text-left uppercase text-ink-muted"><th className="py-1">Local</th><th className="text-right">Qtd. disponível</th><th className="text-right">Valor total</th><th className="w-24" /></tr></thead>
                          <tbody>
                            {l.locais.map((x) => {
                              const ed = editando && editando.produto === l.produto && editando.local === x.local;
                              return (
                                <tr key={x.local} className="border-t border-line">
                                  <td className="py-1 uppercase">{x.local_nome}</td>
                                  <td className="text-right tabular-nums">
                                    {ed ? <CampoNumero aria-label="Nova quantidade" casas={3} value={editando.valor} onChange={(v) => setEditando({ ...editando, valor: v })} className="h-9 w-28 rounded-xs border border-line px-2 text-right" /> : num(x.quantidade)}
                                  </td>
                                  <td className="text-right tabular-nums">{formatarMoeda(x.valor_total)}</td>
                                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                    {podeAjustar && !ed && (
                                      <button type="button" onClick={() => setEditando({ produto: l.produto, local: x.local, valor: x.quantidade })} aria-label={`Ajustar ${l.descricao} em ${x.local_nome}`} className="inline-flex size-8 items-center justify-center text-primary"><IconPencil size={16} /></button>
                                    )}
                                    {ed && (
                                      <>
                                        <button type="button" onClick={salvar} aria-label="Salvar ajuste" className="inline-flex size-8 items-center justify-center text-success"><IconCheck size={16} /></button>
                                        <button type="button" onClick={() => setEditando(null)} aria-label="Cancelar ajuste" className="inline-flex size-8 items-center justify-center text-ink-muted"><IconX size={16} /></button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {l.locais.length === 0 && <p className="py-1 text-xs text-ink-muted">Sem saldo em nenhum local. Use Movimentações › Entrada.</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {dados && dados.results.length === 0 && (
          <p className="py-8 text-center text-sm font-semibold uppercase text-ink-muted">Nenhum registro encontrado. Só aparecem os produtos com "Movimentar estoque" ligado.</p>
        )}
        {dados && (
          <div className="mt-2 flex justify-between bg-line px-4 py-3 text-sm uppercase text-ink-muted">
            <span>Exibindo {dados.count} registros</span>
            <span>Valor total do estoque <strong className="ml-2 text-lg tabular-nums text-primary">{formatarMoeda(dados.valor_total)}</strong></span>
          </div>
        )}
      </div>
    </>
  );
}
