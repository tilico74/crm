import { IconX } from "@tabler/icons-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  /** Botões do rodapé (ex.: Cancelar e Salvar). */
  rodape?: ReactNode;
  /** Largura máxima; a MarketUP usa 750px nos modais de item. */
  largura?: string;
};

/**
 * Modal no modelo da MarketUP (ex.: "Desconto no item" do orçamento):
 * fundo preto a 80% que aparece aos poucos, caixa que desce do topo (0,3 s),
 * faixa de título (cores do design system) com o × quadrado à direita. Esc e o × fecham.
 * O campo que deve abrir com foco leva o atributo `data-autofocus`.
 * Usa <dialog> nativo: foco preso dentro e devolvido ao fechar.
 */
export function Modal({ titulo, onFechar, children, rodape, largura = "max-w-[750px]" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    ref.current?.showModal();
    // showModal() põe o foco no primeiro botão (o ×); o campo marcado com data-autofocus ganha o foco.
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => e.target === ref.current && onFechar()}
      className={cn(
        "mx-auto mt-[8vh] w-[calc(100vw-2rem)] overflow-visible bg-transparent p-0 text-ink",
        "backdrop:bg-black/80 backdrop:animate-in backdrop:fade-in-0 backdrop:duration-150",
        largura,
      )}
    >
      <div className="bg-surface-raised shadow-xl animate-in fade-in-0 slide-in-from-top-12 duration-300 ease-out">
        <div className="flex items-stretch bg-line">
          <h2 id={tituloId} className="flex-1 self-center px-4 py-3 text-lg font-bold uppercase text-primary">
            {titulo}
          </h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="inline-flex w-14 items-center justify-center bg-secondary-light text-ink hover:bg-secondary hover:text-surface-raised">
            <IconX size={26} stroke={3} aria-hidden />
          </button>
        </div>
        <div className="p-3">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-line px-4 py-4">{rodape}</div>}
      </div>
    </dialog>
  );
}

/** Botões do rodapé dos modais e balões: Cancelar neutro (secondary), confirmar com a cor principal (primary). */
export const botaoCancelar = "min-h-12 min-w-24 bg-secondary px-4 text-sm font-semibold uppercase text-surface-raised hover:opacity-90 md:min-h-10";
export const botaoConfirmar = "min-h-12 min-w-24 bg-primary px-4 text-sm font-semibold uppercase text-primary-foreground hover:bg-primary-dark md:min-h-10";

/**
 * Modal "AVISO" da MarketUP: mensagem curta e um botão OK (ex.: "O valor do recebimento excede o valor a receber").
 * Fecha no OK, no × ou com Esc; o foco abre no OK.
 */
export function ModalAviso({ mensagem, onFechar }: { mensagem: string; onFechar: () => void }) {
  return (
    <Modal
      titulo="Aviso"
      onFechar={onFechar}
      rodape={
        <button type="button" onClick={onFechar} data-autofocus className={botaoConfirmar}>
          OK
        </button>
      }
    >
      <p role="alert" className="px-1 py-2 text-base text-ink">{mensagem}</p>
    </Modal>
  );
}
