import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { CepField } from "@/components/CepField";
import { EnderecoField } from "@/components/EnderecoField";
import { TextField } from "@/components/form";
import { api, ApiError } from "@/lib/api";
import { camposDoCep } from "@/lib/localidades";
import { limpar } from "@/lib/mascaras";
import type { Cliente, EnderecoCliente } from "@/resources/clientes/types";

const VAZIO: EnderecoCliente = {
  cep: "", exterior: false, logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", ibge: "", ativo: true, padrao: false,
};

/**
 * Botão "+" verde ao lado dos endereços do orçamento: cadastra o endereço na ficha do cliente
 * (mesmos campos da aba Endereços, com CEP e lupa) e já o escolhe no orçamento.
 */
export function NovoEndereco({ cliente, onCriado, abertoInicial = false }: {
  cliente: Cliente;
  onCriado: (cliente: Cliente, enderecoId: number) => void;
  /** Cliente recém-cadastrado (sem endereço): já abre o formulário, como na MarketUP. */
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [e, setE] = useState<EnderecoCliente>(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<EnderecoCliente>) => setE((x) => ({ ...x, ...parcial }));

  const salvar = async () => {
    if (!e.logradouro.trim()) return setErro("Informe o endereço (ou busque pelo CEP).");
    setSalvando(true);
    setErro("");
    try {
      const antigos = new Set(cliente.enderecos.map((x) => x.id));
      const atualizado = await api<Cliente>(`/clientes/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enderecos: [...cliente.enderecos, e] }),
      });
      const novo = atualizado.enderecos.find((x) => !antigos.has(x.id));
      if (novo?.id) onCriado(atualizado, novo.id);
      setE(VAZIO);
      setAberto(false);
    } catch (falha) {
      setErro(falha instanceof ApiError ? falha.message : "Não foi possível salvar o endereço.");
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} aria-label="Novo endereço" title="Novo endereço" className="inline-flex min-h-[90px] w-24 items-center justify-center rounded-xs bg-primary text-primary-foreground hover:bg-primary-dark">
        <IconPlus size={40} aria-hidden />
      </button>
    );
  }
  return (
    <div className="w-full rounded-xs border border-line bg-surface p-3">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <CepField value={e.cep} onChange={(cep) => mudar({ cep: limpar("cep", cep) })} onEndereco={(r) => mudar(camposDoCep(r))} />
        <EnderecoField
          span={3}
          value={e.logradouro}
          uf={e.uf}
          cidade={e.cidade}
          maxLength={100}
          onChange={(v) => mudar({ logradouro: v })}
          onEndereco={(r) => mudar({ cep: limpar("cep", r.cep), ...camposDoCep(r) })}
        />
        <TextField label="Nº" maxLength={10} value={e.numero} onChange={(x) => mudar({ numero: x.target.value })} />
        <TextField label="Complemento" maxLength={50} value={e.complemento} onChange={(x) => mudar({ complemento: x.target.value })} />
        <TextField label="Bairro" maxLength={50} value={e.bairro} onChange={(x) => mudar({ bairro: x.target.value })} />
        <div className="grid grid-cols-[1fr_64px] gap-2">
          <TextField label="Cidade" maxLength={80} value={e.cidade} onChange={(x) => mudar({ cidade: x.target.value, ibge: "" })} />
          <TextField label="UF" maxLength={2} value={e.uf} onChange={(x) => mudar({ uf: x.target.value.toUpperCase(), ibge: "" })} />
        </div>
      </div>
      {erro && <p role="alert" className="mt-2 text-xs font-semibold text-error">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => { setAberto(false); setErro(""); }} className="min-h-12 px-3 text-xs font-semibold uppercase text-ink-muted md:min-h-[34px]">Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando} className="min-h-12 rounded-xs bg-secondary px-4 text-sm font-bold uppercase text-surface-raised md:min-h-[34px]">
          {salvando ? "Salvando…" : "OK"}
        </button>
      </div>
    </div>
  );
}
