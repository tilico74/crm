import { IconPencil, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Classe da coluna (largura, alinhamento, esconder no celular). */
  className?: string;
};

type Props<T extends { id: number }> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  total?: number;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onMore?: () => void;
  empty?: string;
};

/**
 * Listagem simples da MarketUP (Funcionários, Produtos): cabeçalho em maiúsculas,
 * linhas com lápis e lixeira à direita e "Ver mais registros" no fim.
 * No celular as linhas viram cartões.
 */
export function DataTable<T extends { id: number }>({ columns, rows, loading, total, onEdit, onDelete, onMore, empty }: Props<T>) {
  return (
    <div className="mx-auto max-w-[992px] px-4 pb-10 xl:px-0">
      <table className="w-full border-collapse text-sm text-ink">
        <thead className="hidden md:table-header-group">
          <tr className="h-[72px] border-b border-line text-left text-sm font-bold uppercase text-primary-dark">
            {columns.map((c) => (
              <th key={c.header} scope="col" className={cn("px-1", c.className)}>
                {c.header}
              </th>
            ))}
            {(onEdit || onDelete) && <th scope="col" className="w-24"><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="flex flex-col gap-1 border-b border-line py-3 even:bg-surface md:table-row md:h-16 md:py-0"
            >
              {columns.map((c, i) => (
                <td key={c.header} className={cn("px-1 uppercase", i === 0 ? "font-semibold md:font-normal" : "text-ink-muted md:text-ink", c.className)}>
                  <span className="text-xs font-semibold text-ink-muted md:hidden">{i > 0 && `${c.header}: `}</span>
                  {c.cell(row)}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="flex justify-end gap-1 md:table-cell md:text-right">
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(row)} aria-label="Editar" className="inline-flex size-12 items-center justify-center text-ink hover:text-primary">
                      <IconPencil size={22} aria-hidden />
                    </button>
                  )}
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(row)} aria-label="Excluir" className="inline-flex size-12 items-center justify-center text-error hover:opacity-80">
                      <IconTrash size={22} aria-hidden />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {loading && <p className="py-6 text-ink-muted">Carregando…</p>}
      {!loading && rows.length === 0 && <p className="py-6 text-ink-muted">{empty ?? "Nenhum registro encontrado."}</p>}

      {!loading && total !== undefined && rows.length > 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-xs font-semibold uppercase text-ink-muted">
          <span>
            Exibindo {rows.length} de {total} registros
          </span>
          {onMore && rows.length < total && (
            <button type="button" onClick={onMore} className="min-h-12 px-6 font-bold text-primary hover:text-primary-dark">
              Ver mais registros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
