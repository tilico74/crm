import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ColunaAba<T> = { cabecalho: string; exibir: (linha: T) => ReactNode; classe?: string };

type Props<T extends { id?: number }> = {
  /** Linha em branco para "incluir". */
  nova: T;
  linhas: T[];
  onChange: (linhas: T[]) => void;
  /** Campos da linha de inclusão (fundo cinza, como na MarketUP). */
  campos: (rascunho: T, set: (parcial: Partial<T>) => void) => ReactNode;
  colunas: ColunaAba<T>[];
  /** Mensagem de erro, ou null se a linha está ok. */
  validar: (rascunho: T) => string | null;
  /** Ex.: "Nenhum contato informado para este cliente até o momento!" */
  vazio: string;
  podeSalvar: boolean;
  /** Botões extras no fim de cada linha (ex.: anexo do documento). */
  acoes?: (linha: T) => ReactNode;
  /** Linhas só de leitura (ex.: orçamentos e pedidos no Histórico): sem lápis e sem lixeira. */
  somenteLeitura?: (linha: T) => boolean;
  /** Chave da linha na tabela (padrão: id). */
  chave?: (linha: T) => string | number;
};

let proximoTemporario = -1;

/**
 * Aba da ficha no modelo MarketUP (Endereços, Contatos, Dados bancários, Documentos, Histórico):
 * linha de inclusão em cima com o botão OK e a lista embaixo; lápis carrega a linha para alterar.
 * Linha nova recebe id negativo só na tela — vai sem id para a API, que cria (o Salvar da ficha grava tudo).
 */
export function AbaLista<T extends { id?: number }>({ nova, linhas, onChange, campos, colunas, validar, vazio, podeSalvar, acoes, somenteLeitura, chave }: Props<T>) {
  const [rascunho, setRascunho] = useState<T>(nova);
  const [erro, setErro] = useState("");
  const editando = rascunho.id !== undefined;

  const set = (parcial: Partial<T>) => {
    setErro("");
    setRascunho((r) => ({ ...r, ...parcial }));
  };

  const confirmar = () => {
    const problema = validar(rascunho);
    if (problema) {
      setErro(problema);
      return;
    }
    if (editando) onChange(linhas.map((l) => (l.id === rascunho.id ? rascunho : l)));
    else onChange([...linhas, { ...rascunho, id: proximoTemporario-- }]);
    setRascunho(nova);
  };

  return (
    <div>
      {podeSalvar && (
        <div
          className="-mx-4 -mt-4 bg-line/60 px-4 py-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
              e.preventDefault();
              confirmar();
            }
          }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">{campos(rascunho, set)}</div>
            <div className="flex gap-2">
              {editando && (
                <button type="button" onClick={() => { setRascunho(nova); setErro(""); }} className="min-h-12 px-3 text-xs font-semibold uppercase text-ink-muted hover:text-ink md:min-h-[34px]">
                  Cancelar
                </button>
              )}
              <button type="button" onClick={confirmar} className="min-h-12 min-w-12 rounded-xs bg-secondary px-3 text-sm font-bold uppercase text-surface-raised hover:opacity-90 md:min-h-[34px]">
                OK
              </button>
            </div>
          </div>
          {erro && <p role="alert" className="mt-2 text-xs font-semibold text-error">{erro}</p>}
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold uppercase text-error">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
                {colunas.map((c) => (
                  <th key={c.cabecalho} scope="col" className={cn("px-2 py-2 font-semibold", c.classe)}>{c.cabecalho}</th>
                ))}
                <th className="w-24"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={chave ? chave(linha) : linha.id} className={cn("border-b border-line", !somenteLeitura?.(linha) && rascunho.id === linha.id && "bg-primary-light")}>
                  {colunas.map((c) => (
                    <td key={c.cabecalho} className={cn("px-2 py-2", c.classe)}>{c.exibir(linha)}</td>
                  ))}
                  <td className="whitespace-nowrap text-right">
                    {acoes?.(linha)}
                    {podeSalvar && !somenteLeitura?.(linha) && (
                      <>
                        <button type="button" aria-label="Alterar" onClick={() => { setRascunho(linha); setErro(""); }} className="inline-flex size-12 items-center justify-center text-primary hover:bg-primary-light md:size-9">
                          <IconPencil size={18} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Excluir"
                          onClick={() => {
                            onChange(linhas.filter((l) => l.id !== linha.id));
                            if (rascunho.id === linha.id) setRascunho(nova);
                          }}
                          className="inline-flex size-12 items-center justify-center text-error hover:bg-error-soft md:size-9"
                        >
                          <IconTrash size={18} aria-hidden />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Interruptor OFF/ON das colunas Ativo e Padrão (lista de endereços da MarketUP). */
export function OnOff({ valor, onChange, rotulo, disabled }: { valor: boolean; onChange: (v: boolean) => void; rotulo: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!valor)}
      className="inline-flex min-h-12 items-center md:min-h-0"
    >
      <span className={cn("rounded-l-xs px-2 py-1 text-[10px] font-bold", !valor ? "bg-ink-muted text-surface-raised" : "bg-line text-ink-muted")}>OFF</span>
      <span className={cn("rounded-r-xs px-2 py-1 text-[10px] font-bold", valor ? "bg-primary text-primary-foreground" : "bg-line text-ink-muted")}>ON</span>
    </button>
  );
}
