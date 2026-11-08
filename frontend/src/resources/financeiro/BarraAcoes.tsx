import { Link } from "react-router";

import { cn } from "@/lib/utils";

type Props = {
  voltar: string;
  aviso: string;
  erro: boolean;
  podeSalvar: boolean;
  salvando: boolean;
  onSalvarEVoltar: () => void;
};

/** Aviso do resultado e barra de ações fixa embaixo (mesmo modelo da ficha de funcionário). */
export function BarraAcoes({ voltar, aviso, erro, podeSalvar, salvando, onSalvarEVoltar }: Props) {
  return (
    <>
      {aviso && (
        <p role="status" className={cn("mt-6 rounded-xs px-4 py-3 text-sm font-semibold", erro ? "bg-error-soft text-error" : "bg-success-soft text-success")}>
          {aviso}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-raised lg:left-[88px]">
        <div className="mx-auto flex max-w-[992px] items-center gap-2 px-4 py-3 xl:px-0">
          <Link to={voltar} className="mr-auto inline-flex min-h-12 items-center px-2 text-sm font-semibold uppercase text-primary hover:text-primary-dark">
            Voltar
          </Link>
          {podeSalvar && (
            <>
              <button
                type="button"
                onClick={onSalvarEVoltar}
                disabled={salvando}
                className="min-h-12 rounded-xs border-2 border-primary px-4 text-sm font-bold uppercase text-primary hover:bg-primary-light disabled:opacity-60"
              >
                Salvar e voltar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="min-h-12 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
