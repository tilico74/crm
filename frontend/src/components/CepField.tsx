import { useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { consultarCep, type EnderecoCep } from "@/lib/localidades";
import { limpar } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

import { MaskedField } from "./form";

type Props = {
  label?: string;
  /** CEP limpo (só dígitos). */
  value: string | null | undefined;
  onChange: (cep: string) => void;
  /**
   * Chamado com o endereço do CEP (ViaCEP pelo back-end). O formulário copia
   * logradouro, bairro, cidade, uf e ibge; número e complemento digitados ficam.
   */
  onEndereco: (endereco: EnderecoCep) => void;
  error?: string[] | string;
  disabled?: boolean;
  span?: 1 | 2 | 3 | 4;
};

/**
 * Campo de CEP de TODOS os formulários (ADR-006, skill preencher-endereco):
 * ao completar 8 dígitos válidos, busca o endereço na hora e preenche os campos.
 * CEP não encontrado ou serviço fora do ar: avisa e deixa digitar o endereço à mão.
 */
export function CepField({ label = "CEP", value, onChange, onEndereco, error, disabled, span }: Props) {
  const [aviso, setAviso] = useState("");
  const [buscando, setBuscando] = useState(false);
  const ultimoBuscado = useRef<string>(limpar("cep", value));

  const buscar = async (cep: string) => {
    if (cep.length !== 8 || cep === ultimoBuscado.current) return;
    ultimoBuscado.current = cep;
    setBuscando(true);
    setAviso("");
    try {
      onEndereco(await consultarCep(cep));
    } catch (erro) {
      setAviso(erro instanceof ApiError ? erro.message : "Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className={cn("relative", span === 2 && "sm:col-span-2", span === 3 && "sm:col-span-2 lg:col-span-3", span === 4 && "sm:col-span-2 lg:col-span-4")}>
      <MaskedField
        label={label}
        mascara="cep"
        value={value}
        onChange={(cep) => {
          onChange(cep);
          if (cep.length < 8) {
            setAviso("");
            ultimoBuscado.current = "";
          }
          buscar(cep);
        }}
        error={error ?? (aviso || undefined)}
        disabled={disabled}
        aria-busy={buscando}
      />
      {buscando && (
        <span role="status" className="absolute right-2 top-7 text-xs text-ink-muted">
          Buscando…
        </span>
      )}
    </div>
  );
}
