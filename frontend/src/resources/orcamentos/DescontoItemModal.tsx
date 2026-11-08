import { IconBarcode, IconCamera } from "@tabler/icons-react";
import { useState } from "react";

import { CampoNumero, numeroBr } from "@/components/CampoNumero";
import { botaoCancelar, botaoConfirmar, Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";
import type { Unidade } from "@/resources/catalogo/types";
import type { ListaPreco } from "@/resources/clientes/types";

import { ehFracionada, precoNaLista, unidadesDoItem, type ItemCatalogo } from "./preco";
import { totalItem, type ItemOrcamento } from "./types";

const campo = "h-12 w-full border border-line bg-line px-3 text-right text-base tabular-nums text-ink focus:border-brand-cyan focus:bg-surface-raised focus:outline-none md:h-[34px] md:text-sm";
const rotulo = "mb-1 block text-sm text-ink";

/**
 * "Desconto no item" da MarketUP (% na linha do item): quantidade, unidade, valor unitário
 * e desconto em R$ ou %, com o valor final na hora. Só aplica no Salvar do modal.
 */
export function DescontoItemModal({ item, unidades, catalogo, lista, onSalvar, onFechar }: {
  item: ItemOrcamento;
  unidades: Unidade[];
  /** Item do catálogo: define as unidades de venda (inteira ou fração) e o preço de cada uma. */
  catalogo?: ItemCatalogo;
  lista: ListaPreco | null;
  onSalvar: (item: ItemOrcamento) => void;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<ItemOrcamento>(item);
  const set = (parcial: Partial<ItemOrcamento>) => setRascunho((r) => ({ ...r, ...parcial }));
  // Como na MarketUP: só as unidades em que o item é vendido; sem o catálogo (item antigo), todas.
  const opcoes = catalogo ? unidadesDoItem(catalogo) : unidades.map((u) => ({ id: u.id!, sigla: u.sigla, fracionada: false }));
  const mudarUnidade = (unidade: number) =>
    catalogo
      ? set({ unidade, fragmentado: ehFracionada(catalogo, unidade), valor_unitario: precoNaLista(catalogo, Number(rascunho.quantidade || 0), lista, unidade) })
      : set({ unidade });
  const { total, subtotal, desconto } = totalItem(rascunho);
  const erro = desconto > subtotal ? "O desconto é maior que o valor do item." : !(Number(rascunho.quantidade) > 0) ? "Informe a quantidade." : "";
  const [inteiro, centavos] = numeroBr(total).split(",");

  return (
    <Modal
      titulo="Desconto no item"
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" onClick={onFechar} className={botaoCancelar}>Cancelar</button>
          <button
            type="button"
            disabled={!!erro}
            onClick={() => {
              const unidade = opcoes.find((u) => u.id === rascunho.unidade);
              onSalvar({ ...rascunho, unidade_sigla: unidade?.sigla ?? rascunho.unidade_sigla });
            }}
            className={cn(botaoConfirmar, "disabled:opacity-50")}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="flex items-center gap-4 bg-line/70 px-3 py-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-ink text-ink">
          <IconCamera size={24} stroke={1.5} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
            <IconBarcode size={14} aria-hidden /> {rascunho.codigo_barras || "sem código"}
          </span>
          <span className="block truncate text-base text-ink">{rascunho.descricao}</span>
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 px-1 sm:grid-cols-[1fr_1fr_1fr_0.3fr_1fr_1fr]">
        <label>
          <span className={rotulo}>Quantidade</span>
          <CampoNumero casas={3} value={rascunho.quantidade} onChange={(v) => set({ quantidade: v })} className={campo} data-autofocus />
        </label>
        <label>
          <span className={rotulo}>Unidade</span>
          <select value={rascunho.unidade ?? ""} onChange={(e) => mudarUnidade(Number(e.target.value))} className={cn(campo, "text-left")}>
            {opcoes.map((u) => <option key={u.id} value={u.id}>{u.sigla}{u.fracionada ? " (fração)" : ""}</option>)}
          </select>
        </label>
        <label>
          <span className={rotulo}>Valor Unitário</span>
          <CampoNumero prefixo="R$ " value={rascunho.valor_unitario} onChange={(v) => set({ valor_unitario: v })} className={campo} />
        </label>
        <span className="hidden sm:block" />
        <div>
          <span className={rotulo}>Desconto em</span>
          <span className="flex" role="group" aria-label="Desconto em R$ ou %">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={rascunho.desconto_em_percentual === p}
                onClick={() => set({ desconto_em_percentual: p })}
                className={cn(
                  "h-12 flex-1 border text-sm font-semibold md:h-[36px]",
                  rascunho.desconto_em_percentual === p ? "border-primary bg-primary text-primary-foreground" : "border-primary bg-surface-raised text-ink",
                )}
              >
                {p ? "%" : "R$"}
              </button>
            ))}
          </span>
        </div>
        <label>
          <span className={rotulo}>Desconto ({rascunho.desconto_em_percentual ? "%" : "R$"})</span>
          <CampoNumero
            prefixo={rascunho.desconto_em_percentual ? "" : "R$ "}
            value={rascunho.desconto_em_percentual ? rascunho.desconto_percentual : rascunho.desconto}
            onChange={(v) => set(rascunho.desconto_em_percentual ? { desconto_percentual: v } : { desconto: v })}
            aria-invalid={desconto > subtotal}
            className={cn(campo, "aria-[invalid=true]:border-error")}
          />
        </label>
      </div>

      {erro && <p role="alert" className="mt-3 px-1 text-sm font-semibold text-error">{erro}</p>}
      <p className="mt-6 flex items-baseline justify-end gap-1 px-1 text-ink" aria-live="polite">
        <span className="mr-1 text-sm uppercase">Valor final:</span>
        <span className="text-sm">R$</span>
        <span className="text-2xl tabular-nums">{inteiro}</span>
        <span className="text-base tabular-nums">,{centavos}</span>
        {desconto > 0 && <span className="ml-3 text-xs text-ink-muted">(desconto de R$ {numeroBr(desconto)})</span>}
      </p>
    </Modal>
  );
}
