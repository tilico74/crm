import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

type Props = {
  /** Nome do módulo, acima do título (ex.: "Catálogo"). */
  eyebrow: string;
  title: string;
  /** Barra de ferramentas; o link "ocultar" esconde e mostra. */
  children?: ReactNode;
};

/**
 * Faixa de topo das telas no modelo MarketUP (context/design-system/layout-e-telas.md):
 * coluna de 992px; à esquerda (661px) módulo, título e ferramentas; à direita, o espaço
 * que na MarketUP é do anúncio e no RDX fica vazio.
 */
export function PageHeader({ eyebrow, title, children }: Props) {
  const [hidden, setHidden] = useState(false);

  return (
    <section className="bg-line">
      <div className="mx-auto flex w-full max-w-[992px] gap-[31px] px-4 py-6 xl:px-0">
        <div className="min-w-0 flex-1 xl:max-w-[661px]">
          <p className="text-base font-semibold uppercase text-ink-muted">{eyebrow}</p>
          <div className="flex flex-wrap items-center gap-x-3 border-b border-secondary pb-2">
            <h1 className="text-2xl font-bold uppercase leading-tight text-primary md:text-[30px]">{title}</h1>
            {children && (
              <button
                type="button"
                onClick={() => setHidden((h) => !h)}
                aria-expanded={!hidden}
                className="inline-flex min-h-12 items-center gap-1 text-[11px] font-semibold uppercase text-primary hover:text-primary-dark"
              >
                {hidden ? <IconChevronDown size={16} aria-hidden /> : <IconChevronUp size={16} aria-hidden />}
                {hidden ? "Mostrar" : "Ocultar"}
              </button>
            )}
          </div>
          {children && !hidden && <div className="mt-6">{children}</div>}
        </div>
        <div aria-hidden className="hidden w-[300px] shrink-0 xl:block" />
      </div>
    </section>
  );
}
