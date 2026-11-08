import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { formatar, limpar, TAMANHO_MAXIMO, TECLADO, validar, type TipoMascara } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

// Peças do formulário no modelo MarketUP (skills/criar-tela-formulario/SKILL.md):
// seção com título de 30px, grade de 4 colunas, campo de 34px (48px em tela de toque)
// e rótulo em PT Sans Narrow 4px acima.

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-4 text-2xl font-normal uppercase text-primary md:text-[30px]">{title}</h2>
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

const controle =
  "w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none aria-[invalid=true]:border-error md:text-sm h-12 [@media(pointer:fine)]:h-[34px]";

type FieldProps = {
  label: string;
  error?: string[] | string;
  /** Colunas da grade ocupadas no computador (1 a 4). */
  span?: 1 | 2 | 3 | 4;
  required?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
};

export function Field({ label, error, span = 1, required, children }: FieldProps) {
  const id = useId();
  const erroId = error ? `${id}-erro` : undefined;
  const mensagem = Array.isArray(error) ? error.join(" ") : error;
  return (
    <div className={cn(span === 2 && "sm:col-span-2", span === 3 && "sm:col-span-2 lg:col-span-3", span === 4 && "sm:col-span-2 lg:col-span-4")}>
      <label htmlFor={id} className="mb-1 block font-label text-sm text-ink-muted">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children(id, erroId)}
      {mensagem && (
        <p id={erroId} className="mt-1 text-xs font-semibold text-error">
          {mensagem}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string[] | string; span?: 1 | 2 | 3 | 4 };

export function TextField({ label, error, span, required, className, ...props }: InputProps) {
  return (
    <Field label={label} error={error} span={span} required={required}>
      {(id, describedBy) => (
        <input id={id} aria-invalid={!!error} aria-describedby={describedBy} required={required} className={cn(controle, className)} {...props} />
      )}
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string[] | string;
  span?: 1 | 2 | 3 | 4;
  options: { value: string | number; label: string }[];
};

export function SelectField({ label, error, span, options, required, ...props }: SelectProps) {
  return (
    <Field label={label} error={error} span={span} required={required}>
      {(id, describedBy) => (
        <select id={id} aria-invalid={!!error} aria-describedby={describedBy} required={required} className={controle} {...props}>
          <option value="">Selecione</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string[] | string; span?: 1 | 2 | 3 | 4 };

export function TextAreaField({ label, error, span = 4, ...props }: TextAreaProps) {
  return (
    <Field label={label} error={error} span={span}>
      {(id, describedBy) => (
        <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy} rows={3} className={cn(controle, "h-auto py-2 [@media(pointer:fine)]:h-auto")} {...props} />
      )}
    </Field>
  );
}

/** Interruptor OFF/ON da MarketUP, como caixa de seleção acessível. */
export function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end [@media(pointer:fine)]:min-h-[34px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-secondary-light transition peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-cyan after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
      />
      <span className="font-label text-sm text-ink">{label}</span>
    </label>
  );
}

type MaskedProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  label: string;
  /** Tipo de máscara (src/lib/mascaras.ts). */
  mascara: TipoMascara;
  /** Valor LIMPO (como vem e vai para a API). */
  value: string | null | undefined;
  onChange: (limpo: string) => void;
  error?: string[] | string;
  span?: 1 | 2 | 3 | 4;
};

/**
 * Campo com máscara: mostra formatado enquanto digita, entrega o valor limpo
 * e valida ao sair do campo (CPF, CNPJ, CEP, telefone). O back-end valida de novo.
 */
export function MaskedField({ label, mascara, value, onChange, error, span, required, onBlur, className, ...props }: MaskedProps) {
  const [aviso, setAviso] = useState("");
  return (
    <Field label={label} error={error ?? (aviso || undefined)} span={span} required={required}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={!!(error || aviso)}
          aria-describedby={describedBy}
          required={required}
          inputMode={TECLADO[mascara]}
          maxLength={TAMANHO_MAXIMO[mascara]}
          autoComplete="off"
          className={cn(controle, "tabular-nums", className)}
          {...props}
          value={formatar(mascara, value)}
          onChange={(e) => {
            setAviso("");
            onChange(limpar(mascara, e.target.value));
          }}
          onBlur={(e) => {
            setAviso(validar(mascara, value ?? ""));
            onBlur?.(e);
          }}
        />
      )}
    </Field>
  );
}
