import { IconMapPinSearch, IconX } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { listarEstados, listarMunicipios, pesquisarEnderecos, type EnderecoCep, type Estado, type Municipio } from "@/lib/localidades";
import { formatarCep } from "@/lib/mascaras";

type Props = {
  /** UF e cidade já preenchidas no formulário (o modal abre com elas escolhidas). */
  ufInicial?: string;
  cidadeInicial?: string;
  /** Texto já digitado no campo Endereço do formulário. */
  termoInicial?: string;
  onSelecionar: (endereco: EnderecoCep) => void;
  onFechar: () => void;
};

const MINIMO = 3; // regra do ViaCEP: cidade e rua com pelo menos 3 letras
const ESPERA = 400; // ms depois de parar de digitar

const campo =
  "h-12 w-full rounded-xs border border-line bg-surface-raised px-3 text-base text-ink focus:border-brand-cyan focus:outline-none disabled:opacity-60 [@media(pointer:fine)]:h-[34px] md:text-sm";

/**
 * Modal "Não sei o CEP" (skill preencher-endereco): escolhe UF e cidade (IBGE),
 * digita a rua e, a partir da 3ª letra, lista os endereços do ViaCEP para escolher.
 * Ao escolher, fecha e devolve o endereço completo (com CEP) para o formulário.
 */
export function BuscaEnderecoModal({ ufInicial = "", cidadeInicial = "", termoInicial = "", onSelecionar, onFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [uf, setUf] = useState(ufInicial);
  const [cidade, setCidade] = useState(cidadeInicial);
  const [termo, setTermo] = useState(termoInicial);
  const [resultados, setResultados] = useState<EnderecoCep[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    ref.current?.showModal();
    listarEstados().then(setEstados, () => setAviso("Não foi possível carregar os estados. Tente de novo em instantes."));
  }, []);

  useEffect(() => {
    setMunicipios([]);
    if (!uf) return;
    listarMunicipios(uf).then(setMunicipios, () => setAviso("Não foi possível carregar as cidades. Tente de novo em instantes."));
  }, [uf]);

  // Pesquisa a partir da 3ª letra, 400 ms depois de parar de digitar.
  useEffect(() => {
    setResultados(null);
    setAviso("");
    if (!uf || cidade.length < MINIMO || termo.trim().length < MINIMO) return;
    let cancelado = false;
    const t = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const lista = await pesquisarEnderecos(uf, cidade, termo.trim());
        if (!cancelado) setResultados(lista);
      } catch (erro) {
        if (!cancelado) setAviso(erro instanceof ApiError ? erro.message : "Não foi possível pesquisar. Tente de novo.");
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, ESPERA);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [uf, cidade, termo]);

  const faltando = !uf ? "Escolha a UF." : !cidade ? "Escolha a cidade." : termo.trim().length < MINIMO ? `Digite pelo menos ${MINIMO} letras do endereço.` : "";

  return (
    <dialog
      ref={ref}
      onCancel={onFechar}
      aria-labelledby={tituloId}
      className="m-auto w-[min(640px,96vw)] rounded-xs border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between bg-line px-5 py-2">
        <h2 id={tituloId} className="flex items-center gap-2 text-base font-bold uppercase text-primary">
          <IconMapPinSearch size={22} aria-hidden />
          Pesquisar endereço
        </h2>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="inline-flex size-12 items-center justify-center text-ink-muted hover:text-ink">
          <IconX size={22} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 pt-5 sm:grid-cols-[110px_1fr]">
        <label className="block">
          <span className="mb-1 block font-label text-sm text-ink-muted">UF</span>
          <select
            autoFocus={!ufInicial}
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              setCidade("");
            }}
            className={campo}
          >
            <option value="">UF</option>
            {estados.map((e) => (
              <option key={e.sigla} value={e.sigla} title={e.nome}>
                {e.sigla}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-label text-sm text-ink-muted">Cidade</span>
          <select value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!uf || !municipios.length} className={campo}>
            <option value="">{uf ? "Selecione a cidade" : "Escolha a UF primeiro"}</option>
            {/* Mantém a cidade do formulário mesmo antes da lista do IBGE chegar. */}
            {cidade && !municipios.some((m) => m.nome === cidade) && <option value={cidade}>{cidade}</option>}
            {municipios.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-label text-sm text-ink-muted">Endereço</span>
          <input
            type="search"
            autoFocus={!!ufInicial}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            // O modal fica dentro do formulário: Enter aqui não pode enviar (salvar) o formulário.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Ex.: Rua José Pedro"
            autoComplete="off"
            className={campo}
          />
        </label>
      </div>

      <div className="px-5 pb-5 pt-3">
        <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-muted">
          {aviso ||
            faltando ||
            (buscando
              ? "Buscando…"
              : resultados && (resultados.length ? `${resultados.length} endereço(s) encontrado(s). Escolha um.` : "Nenhum endereço encontrado. Confira a cidade e o nome da rua."))}
        </p>

        {!!resultados?.length && (
          <ul className="mt-2 max-h-[min(320px,45vh)] overflow-y-auto rounded-xs border border-line">
            {resultados.map((r) => (
              <li key={`${r.cep}-${r.complemento}`} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    onSelecionar(r);
                    onFechar();
                  }}
                  className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-primary-light focus-visible:bg-primary-light"
                >
                  <span className="text-sm font-semibold">
                    {r.logradouro}
                    {r.complemento && <span className="font-normal text-ink-muted"> — {r.complemento}</span>}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {r.bairro} · {r.cidade}/{r.uf} · CEP <span className="tabular-nums">{formatarCep(r.cep)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
