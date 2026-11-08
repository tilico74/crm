import { IconX } from "@tabler/icons-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { botaoCancelar, botaoConfirmar } from "./Modal";

type Props = {
  /** Ícone/botão que abre o balão (ex.: balão de observação do item). */
  gatilho: (abrir: () => void, aberto: boolean) => ReactNode;
  titulo: string;
  valorInicial: string;
  onConfirmar: (valor: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /** Texto do botão de confirmar (Confirmar na observação do item; Salvar nos comentários). */
  rotuloConfirmar?: string;
  /** Só o botão de confirmar, sem Cancelar (comentários do orçamento na MarketUP). */
  semCancelar?: boolean;
  /** Título em maiúsculas pequenas, como "COMENTÁRIOS". */
  tituloMaiusculo?: boolean;
};

const LARGURA = 300;

/**
 * Balão flutuante de edição rápida, como a "Observação" do item na MarketUP:
 * caixa de 300px (neutros do design system) acima do ícone, com seta apontando para ele, título, ×,
 * área de texto e os botões Cancelar / Confirmar. Esc ou clique fora cancelam;
 * Enter confirma. Abre num portal (fica por cima de tabelas com rolagem).
 */
export function BalaoEdicao({ gatilho, titulo, valorInicial, onConfirmar, maxLength, disabled, rotuloConfirmar = "Confirmar", semCancelar, tituloMaiusculo }: Props) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(valorInicial);
  const [posicao, setPosicao] = useState<{ left: number; bottom: number; seta: number } | null>(null);
  const ancora = useRef<HTMLSpanElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  const abrir = () => {
    if (disabled) return;
    setTexto(valorInicial);
    setAberto(true);
  };
  const fechar = () => setAberto(false);
  const confirmar = () => {
    onConfirmar(texto.trim());
    fechar();
  };

  // Posição: acima do ícone, alinhada pela direita, sem sair da tela.
  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      const r = ancora.current?.getBoundingClientRect();
      if (!r) return;
      const centro = r.left + r.width / 2;
      const left = Math.max(8, Math.min(centro + 26 - LARGURA, window.innerWidth - LARGURA - 8));
      setPosicao({ left, bottom: window.innerHeight - r.top + 6, seta: centro - left - 7 });
    };
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !ancora.current?.contains(alvo)) fechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <span ref={ancora} className="inline-flex">
      {gatilho(abrir, aberto)}
      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={caixa}
            role="dialog"
            aria-labelledby={id}
            style={{ left: posicao.left, bottom: posicao.bottom, width: LARGURA }}
            className="fixed z-50 max-w-[calc(100vw-16px)] origin-bottom border border-secondary-light bg-line p-[15px] text-left shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
          >
            {/* Seta de 7px apontando para o ícone. */}
            <span aria-hidden style={{ left: posicao.seta }} className="absolute top-full border-x-[7px] border-t-[7px] border-x-transparent border-t-secondary-light" />
            <div className="mb-1 flex items-start justify-between">
              <label id={id} htmlFor={`${id}-texto`} className={cn("font-semibold text-ink", tituloMaiusculo ? "text-xs uppercase" : "text-sm")}>{titulo}</label>
              <button type="button" onClick={fechar} aria-label="Fechar" className="-mr-1 -mt-1 inline-flex size-8 items-center justify-center text-ink-muted hover:text-ink">
                <IconX size={20} stroke={3} aria-hidden />
              </button>
            </div>
            <textarea
              id={`${id}-texto`}
              autoFocus
              rows={2}
              maxLength={maxLength}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  confirmar();
                }
              }}
              className="h-[54px] w-full resize-none border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus:border-brand-cyan focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-1">
              {!semCancelar && <button type="button" onClick={fechar} className={cn(botaoCancelar, "min-w-0 md:min-h-8")}>Cancelar</button>}
              <button type="button" onClick={confirmar} className={cn(botaoConfirmar, "min-w-0 md:min-h-8")}>{rotuloConfirmar}</button>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
