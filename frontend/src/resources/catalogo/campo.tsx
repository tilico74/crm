import { cn } from "@/lib/utils";

/** Campo de texto das linhas em edição (TabelaEditavel), com o erro embaixo. */
export function CampoLinha({ rotulo, valor, onChange, erro, autoFocus, maxLength, className }: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  autoFocus?: boolean;
  maxLength?: number;
  className?: string;
}) {
  return (
    <>
      <input
        aria-label={rotulo}
        aria-invalid={!!erro}
        autoFocus={autoFocus}
        maxLength={maxLength}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-12 w-full rounded-xs border border-line bg-surface-raised px-2 text-base text-ink focus:border-brand-cyan focus:outline-none aria-[invalid=true]:border-error md:h-[34px] md:text-sm",
          className,
        )}
      />
      {erro && <p className="mt-1 text-xs font-semibold normal-case text-error">{erro}</p>}
    </>
  );
}
