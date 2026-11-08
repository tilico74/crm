import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useImperativeHandle, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "./ConfirmDialog";

export type ColunaEditavel<T> = {
  cabecalho: string;
  /** Campo da API editado na coluna (para mostrar o erro dele). */
  campo?: string;
  /** Largura/alinhamento da coluna (ex.: "w-24 text-center"). */
  classe?: string;
  exibir: (linha: T) => ReactNode;
  /** Campo de edição; sem `editar`, a coluna fica só de leitura também na edição. */
  editar?: (rascunho: T, set: (parcial: Partial<T>) => void, erro?: string) => ReactNode;
};

export type TabelaEditavelRef = { adicionar: () => void };

type Props<T extends { id?: number }> = {
  ref?: Ref<TabelaEditavelRef>;
  colunas: ColunaEditavel<T>[];
  linhas: T[];
  carregando?: boolean;
  /** Modelo de linha nova ("Adicionar novo"). */
  nova: T;
  /** Nome do registro para os avisos e rótulos (ex.: (u) => u.nome). */
  descrever: (linha: T) => string;
  podeEditar?: (linha: T) => boolean;
  podeExcluir?: (linha: T) => boolean;
  onSalvar: (rascunho: T) => Promise<void>;
  onExcluir?: (linha: T) => Promise<void>;
  /** Botões extras no fim da linha (ex.: "Enviar foto" da marca). */
  acoesExtras?: (linha: T) => ReactNode;
  vazio?: string;
  /** Mostrar "salvo" após confirmar a linha (desligue quando a gravação real é depois, no Salvar da ficha). */
  avisarAoSalvar?: boolean;
};

/**
 * Lista com edição na própria linha, como as telas simples da MarketUP
 * (Unidades, Marcas, Contas correntes): lápis → campos + ✓ confirmar / ✗ cancelar;
 * "Adicionar novo" (via ref.adicionar) abre uma linha no topo. Enter confirma, Esc cancela.
 */
export function TabelaEditavel<T extends { id?: number }>(props: Props<T>) {
  const { ref, colunas, linhas, carregando, nova, descrever, podeEditar, podeExcluir, onSalvar, onExcluir, acoesExtras, vazio, avisarAoSalvar = true } = props;
  const [rascunho, setRascunho] = useState<T | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<T | null>(null);

  const abrir = (linha: T) => {
    setErros({});
    setAviso(null);
    setRascunho({ ...linha });
  };
  useImperativeHandle(ref, () => ({ adicionar: () => (rascunho ? undefined : abrir(nova)) }), [rascunho, nova]);

  const cancelar = () => {
    setRascunho(null);
    setErros({});
  };

  const confirmar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    try {
      await onSalvar(rascunho);
      setAviso(avisarAoSalvar ? { texto: `${descrever(rascunho)} salvo(a).`, erro: false } : null);
      setRascunho(null);
      setErros({});
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErros(Object.fromEntries(Object.entries(erro.errors).map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)])));
        setAviso({ texto: erro.message, erro: true });
      }
    } finally {
      setSalvando(false);
    }
  };

  const teclas = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    } else if (e.key === "Escape") {
      cancelar();
    }
  };

  const linhaEdicao = (r: T) => (
    <tr key={r.id ?? "nova"} onKeyDown={teclas} className="flex flex-col gap-2 border-b-2 border-primary bg-primary-light/40 p-3 md:table-row md:p-0">
      {colunas.map((c) => (
        <td key={c.cabecalho} className={cn("px-1 md:py-2", c.classe)}>
          <span className="text-xs text-ink-muted md:hidden">{c.cabecalho}</span>
          {c.editar ? c.editar(r, (parcial) => setRascunho({ ...r, ...parcial }), c.campo ? erros[c.campo] : undefined) : c.exibir(r)}
        </td>
      ))}
      <td className="flex justify-end gap-1 px-1 md:table-cell md:whitespace-nowrap md:text-right">
        <button type="button" onClick={confirmar} disabled={salvando} aria-label="Confirmar" title="Confirmar (Enter)" className="inline-flex size-12 items-center justify-center text-success hover:bg-success-soft disabled:opacity-50">
          <IconCheck size={24} aria-hidden />
        </button>
        <button type="button" onClick={cancelar} aria-label="Cancelar" title="Cancelar (Esc)" className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft">
          <IconX size={24} aria-hidden />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-[992px] px-4 pb-10 xl:px-0">
      {aviso && (
        <p role="status" className={cn("mt-4 rounded-xs px-4 py-3 text-sm font-semibold", aviso.erro ? "bg-error-soft text-error" : "bg-success-soft text-success")}>
          {aviso.texto}
        </p>
      )}

      <table className="w-full border-collapse text-sm text-ink">
        <thead className="hidden md:table-header-group">
          <tr className="h-[72px] border-b border-line text-left text-sm font-bold uppercase text-primary-dark">
            {colunas.map((c) => (
              <th key={c.cabecalho} scope="col" className={cn("px-1", c.classe)}>
                {c.cabecalho}
              </th>
            ))}
            <th scope="col" className="w-[150px]"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {rascunho && rascunho.id === undefined && linhaEdicao(rascunho)}
          {linhas.map((l) =>
            rascunho && rascunho.id === l.id ? (
              linhaEdicao(rascunho)
            ) : (
              <tr key={l.id} className="flex flex-col gap-1 border-b border-line py-3 uppercase even:bg-surface md:table-row md:h-16 md:py-0">
                {colunas.map((c, i) => (
                  <td key={c.cabecalho} className={cn("px-1", i === 0 && "font-semibold md:font-normal", c.classe)}>
                    {i > 0 && <span className="text-xs font-semibold normal-case text-ink-muted md:hidden">{c.cabecalho}: </span>}
                    {c.exibir(l)}
                  </td>
                ))}
                <td className="flex justify-end gap-1 md:table-cell md:whitespace-nowrap md:text-right">
                  {acoesExtras?.(l)}
                  {(podeEditar?.(l) ?? true) && (
                    <button type="button" onClick={() => abrir(l)} disabled={!!rascunho} aria-label={`Editar ${descrever(l)}`} className="inline-flex size-12 items-center justify-center hover:text-primary disabled:opacity-40">
                      <IconPencil size={22} aria-hidden />
                    </button>
                  )}
                  {onExcluir && (podeExcluir?.(l) ?? true) && (
                    <button type="button" onClick={() => setExcluir(l)} disabled={!!rascunho} aria-label={`Excluir ${descrever(l)}`} className="inline-flex size-12 items-center justify-center text-error hover:opacity-80 disabled:opacity-40">
                      <IconTrash size={22} aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {carregando && <p className="py-6 text-ink-muted">Carregando…</p>}
      {!carregando && !linhas.length && !rascunho && <p className="py-6 text-ink-muted">{vazio ?? "Nenhum registro."}</p>}
      {!!linhas.length && <p className="py-6 text-center text-xs font-semibold uppercase text-ink-muted">Exibindo {linhas.length} registros</p>}

      {excluir && onExcluir && (
        <ConfirmDialog
          title="Excluir"
          message={avisarAoSalvar ? `Excluir ${descrever(excluir)}? Isso não pode ser desfeito.` : `Remover ${descrever(excluir)} da lista? A exclusão só vale depois de salvar a ficha.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluir(null)}
          onConfirm={async () => {
            const alvo = excluir;
            setExcluir(null);
            try {
              await onExcluir(alvo);
              setAviso(avisarAoSalvar ? { texto: `${descrever(alvo)} excluído(a).`, erro: false } : null);
            } catch (erro) {
              setAviso({ texto: erro instanceof ApiError ? erro.message : "Não foi possível excluir.", erro: true });
            }
          }}
        />
      )}
    </div>
  );
}
