import { useEffect, useState } from "react";

import { MaskedField, TextField } from "@/components/form";
import { api, ApiError } from "@/lib/api";
import { limpar } from "@/lib/mascaras";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/resources/clientes/types";

type Campos = { documento: string; rgIe: string; email: string; telefone: string };

const dosDados = (c: Cliente): Campos => ({
  documento: c.tipo_pessoa === "J" ? c.cnpj : c.cpf,
  rgIe: c.tipo_pessoa === "J" ? c.inscricao_estadual : c.rg,
  email: c.email,
  telefone: c.telefone || c.celular,
});

/**
 * Linha "CPF ou CNPJ · RG ou IE · E-mail · Telefone" do orçamento, como na MarketUP:
 * dá para completar o cadastro do cliente ali mesmo (principalmente o recém-cadastrado).
 * O botão "Salvar cliente" só aparece quando algo mudou; grava na ficha do cliente.
 * CPF (11 dígitos) deixa o cliente como pessoa física; CNPJ (14), como jurídica.
 */
export function DadosCliente({ cliente, podeAlterar, onSalvo }: { cliente: Cliente; podeAlterar: boolean; onSalvo: (c: Cliente) => void }) {
  const [campos, setCampos] = useState<Campos>(dosDados(cliente));
  const [erros, setErros] = useState<Record<string, unknown>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setCampos(dosDados(cliente)), [cliente]);

  const original = dosDados(cliente);
  const mudou = (Object.keys(campos) as (keyof Campos)[]).some((k) => (campos[k] ?? "") !== (original[k] ?? ""));
  const set = (k: keyof Campos, v: string) => setCampos((c) => ({ ...c, [k]: v }));
  const erro = (k: string) => (erros[k] ? String(erros[k]) : undefined);

  const salvar = async () => {
    const documento = limpar("cpfCnpj", campos.documento);
    const juridica = documento.length === 14 || (!documento && cliente.tipo_pessoa === "J");
    const corpo = juridica
      ? { tipo_pessoa: "J", cnpj: documento, inscricao_estadual: campos.rgIe, email: campos.email, telefone: campos.telefone }
      : { tipo_pessoa: "F", cpf: documento, rg: campos.rgIe, email: campos.email, telefone: campos.telefone };
    setSalvando(true);
    setErros({});
    try {
      onSalvo(await api<Cliente>(`/clientes/${cliente.id}`, { method: "PATCH", body: JSON.stringify(corpo) }));
    } catch (e) {
      if (e instanceof ApiError) {
        const { cpf, cnpj, rg, inscricao_estadual, ...resto } = e.errors as Record<string, unknown>;
        setErros({ ...resto, documento: cpf ?? cnpj, rgIe: rg ?? inscricao_estadual, geral: Object.keys(e.errors).length ? "" : e.message });
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-4">
        <MaskedField label="CPF ou CNPJ" mascara="cpfCnpj" value={campos.documento} onChange={(v) => set("documento", v)} error={erro("documento")} disabled={!podeAlterar} />
        <TextField label="RG ou IE" maxLength={20} value={campos.rgIe} onChange={(e) => set("rgIe", e.target.value)} error={erro("rgIe")} disabled={!podeAlterar} />
        <TextField label="E-mail" type="email" className="normal-case" maxLength={254} value={campos.email} onChange={(e) => set("email", e.target.value)} error={erro("email")} disabled={!podeAlterar} />
        <MaskedField label="Telefone" mascara="telefone" value={campos.telefone} onChange={(v) => set("telefone", v)} error={erro("telefone")} disabled={!podeAlterar} />
      </div>
      {podeAlterar && mudou && (
        <div className="mt-2 flex items-center justify-end gap-3 animate-in fade-in-0 duration-200">
          <span className="text-xs text-ink-muted">Os dados mudaram: grave na ficha do cliente.</span>
          <button type="button" onClick={() => { setCampos(original); setErros({}); }} className="min-h-12 px-3 text-xs font-semibold uppercase text-ink-muted hover:text-ink md:min-h-9">
            Desfazer
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className={cn("min-h-12 rounded-xs bg-primary px-4 text-xs font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60 md:min-h-9")}
          >
            {salvando ? "Salvando…" : "Salvar cliente"}
          </button>
        </div>
      )}
    </div>
  );
}
