import { IconSearch } from "@tabler/icons-react";
import { useState, type InputHTMLAttributes } from "react";

import type { EnderecoCep } from "@/lib/localidades";
import { cn } from "@/lib/utils";

import { BuscaEnderecoModal } from "./BuscaEnderecoModal";
import { Field } from "./form";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  label?: string;
  value: string;
  onChange: (valor: string) => void;
  /** Endereço escolhido no modal (com CEP): o formulário preenche CEP, rua, bairro, cidade, UF e IBGE. */
  onEndereco: (endereco: EnderecoCep) => void;
  /** UF e cidade do formulário, para o modal já abrir com elas. */
  uf?: string;
  cidade?: string;
  error?: string[] | string;
  span?: 1 | 2 | 3 | 4;
};

/**
 * Campo "Endereço" de TODOS os formulários (ADR-006, skill preencher-endereco):
 * input com o botão da lupa acoplado no final, que abre o modal de pesquisa
 * para quem não sabe o CEP.
 */
export function EnderecoField({ label = "Endereço", value, onChange, onEndereco, uf, cidade, error, span, disabled, className, ...props }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <Field label={label} error={error} span={span}>
      {(id, describedBy) => (
        <div className="flex">
          <input
            id={id}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-12 min-w-0 flex-1 rounded-l-xs border border-r-0 border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none aria-[invalid=true]:border-error md:text-sm [@media(pointer:fine)]:h-[34px]",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setAberto(true)}
            disabled={disabled}
            aria-label="Pesquisar endereço (não sei o CEP)"
            title="Não sei o CEP: pesquisar pelo endereço"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-r-xs border border-primary bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-60 [@media(pointer:fine)]:h-[34px] [@media(pointer:fine)]:w-10"
          >
            <IconSearch size={18} aria-hidden />
          </button>
          {aberto && (
            <BuscaEnderecoModal
              ufInicial={uf}
              cidadeInicial={cidade}
              termoInicial={value}
              onSelecionar={onEndereco}
              onFechar={() => setAberto(false)}
            />
          )}
        </div>
      )}
    </Field>
  );
}
