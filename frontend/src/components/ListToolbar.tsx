import { IconCloudDownload, IconFilter, IconListDetails, IconPrinter, IconUpload } from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** Tela ainda sem dados: os controles aparecem, mas não fazem nada. */
  preview?: boolean;
  /** Busca "Localizar por": chamada 300 ms depois de parar de digitar. */
  onSearch?: (termo: string) => void;
  /** Sem `onAdd` (ou sem permissão de adicionar), o "Adicionar novo" não aparece. */
  onAdd?: () => void;
};

const ACTIONS = [
  { label: "Visualizar", icon: IconListDetails },
  { label: "Importar", icon: IconUpload },
  { label: "Imprimir", icon: IconPrinter },
  { label: "Exportar", icon: IconCloudDownload },
];

/**
 * Barra de ferramentas da listagem, com as medidas da MarketUP:
 * busca "Localizar por" com 4 filtros, 4 blocos de 76×76 e "Adicionar novo" de 152×152.
 * No celular os blocos ficam em linha e o "Adicionar novo" vai para baixo, fixo.
 */
export function ListToolbar({ preview, onSearch, onAdd }: Props) {
  const searchId = useId();
  const [termo, setTermo] = useState("");
  // Blocos ainda sem função (filtros, importar, imprimir, exportar) entram com cada módulo.
  const off = { "aria-disabled": true, title: "Em construção" } as const;

  useEffect(() => {
    if (!onSearch) return;
    const t = window.setTimeout(() => onSearch(termo.trim()), 300);
    return () => window.clearTimeout(t);
  }, [termo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-[2px] md:h-[152px] md:flex-row">
      <div className="flex-1 bg-surface-raised px-5 py-3">
        <label htmlFor={searchId} className="text-xs font-semibold uppercase text-primary-dark">
          Localizar por
        </label>
        <input
          id={searchId}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          disabled={preview}
          placeholder="Buscar termo"
          className="mt-1 h-12 w-full border-b border-line bg-transparent px-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus-visible:border-brand-cyan md:h-9 md:text-sm"
        />
        <div className="mt-2 grid grid-cols-2 gap-[6px]">
          <button
            type="button"
            {...off}
            className="min-h-12 rounded-xs border border-dashed border-primary text-[11px] font-semibold uppercase text-primary hover:bg-primary-light md:min-h-[26px]"
          >
            Adicionar filtro
          </button>
          {[2, 3, 4].map((n) => (
            <div
              key={n}
              aria-hidden
              className="relative hidden h-[26px] items-center overflow-hidden rounded-xs border border-line px-2 text-secondary-light md:flex"
            >
              <IconFilter size={14} />
              <span className="absolute -bottom-1 right-1 text-2xl font-bold italic leading-none text-line">#{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-[2px] md:w-[154px] md:grid-cols-2">
        {ACTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            {...off}
            aria-label={label}
            className="flex h-[60px] items-center justify-center bg-surface-raised text-primary hover:bg-primary-light md:size-[76px]"
          >
            <Icon size={36} stroke={1.5} aria-hidden />
          </button>
        ))}
      </div>

      {(preview || onAdd) && (
        <button
          type="button"
          onClick={preview ? undefined : onAdd}
          {...(preview ? off : {})}
          aria-label="Adicionar novo"
          className={cn(
            "fixed inset-x-0 bottom-0 z-10 flex h-14 items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary-dark",
            "md:static md:size-[152px] md:flex-col md:gap-0",
          )}
        >
          <span className="text-sm font-bold uppercase">Adicionar</span>
          <span className="text-sm font-bold uppercase md:text-2xl">Novo</span>
        </button>
      )}
    </div>
  );
}
