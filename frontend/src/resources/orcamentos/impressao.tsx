// Peças comuns das impressões (orçamento, pedido, recibo), no modelo da impressão da MarketUP
// aprovado pelo usuário em 08/11/2026: topo com logotipo e empresa, seções com faixa cinza, rodapé "Impresso em".
import { IconPrinter } from "@tabler/icons-react";
import { type ReactNode } from "react";

import { formatarCep, formatarCnpj, formatarTelefone } from "@/lib/mascaras";
import { cn } from "@/lib/utils";

export type Empresa = {
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  email: string;
  telefone: string;
  logotipo: string | null;
  enderecos: { tipo: string; cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string }[];
};

export const agora = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }).replace(",", "");

/** Endereço de faturamento da empresa (o que vai no topo e na cidade do recibo). */
export const enderecoEmpresa = (empresa: Empresa | null) => empresa?.enderecos.find((e) => e.tipo === "faturamento" && e.logradouro);

/** Fundo cinza na tela, botão "Imprimir / Salvar PDF" e a folha A4 (em pé). */
export function FolhaImpressao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <style>{"@page { size: A4; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <div className="mx-auto flex max-w-[210mm] justify-end gap-2 px-4 py-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center gap-2 rounded-xs bg-primary px-6 text-sm font-bold uppercase text-primary-foreground">
          <IconPrinter size={20} aria-hidden /> Imprimir / Salvar PDF
        </button>
      </div>
      <article className={cn("mx-auto flex max-w-[210mm] flex-col bg-white p-8 text-[11px] leading-snug text-black shadow print:max-w-none print:p-0 print:shadow-none", className)}>
        {children}
      </article>
    </div>
  );
}

/** Topo: logotipo à esquerda e dados da empresa à direita, como na MarketUP. */
export function CabecalhoEmpresa({ empresa }: { empresa: Empresa | null }) {
  const endereco = enderecoEmpresa(empresa);
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex h-20 w-44 items-center">
        {empresa?.logotipo && <img src={empresa.logotipo} alt="" className="max-h-20 max-w-44 object-contain" />}
      </div>
      <div className="text-right text-[10px] uppercase leading-tight tracking-wide">
        {empresa?.razao_social && <p>{empresa.razao_social}</p>}
        {empresa?.nome_fantasia && <p>{empresa.nome_fantasia}</p>}
        {empresa?.cnpj && <p>CNPJ: {formatarCnpj(empresa.cnpj)}</p>}
        {endereco && (
          <>
            <p className="normal-case">
              {endereco.logradouro}, {endereco.numero}
            </p>
            <p className="normal-case">
              {formatarCep(endereco.cep)} - {endereco.cidade} - {endereco.uf}
            </p>
          </>
        )}
        {empresa?.telefone && <p>{formatarTelefone(empresa.telefone)}</p>}
      </div>
    </header>
  );
}

/** Faixa de título das seções, como na impressão da MarketUP (barra à esquerda e linha cinza). */
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid-page">
      <h2 className="border-b-2 border-l-4 border-gray-400 bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{titulo}</h2>
      <div className="px-1 pt-1.5">{children}</div>
    </section>
  );
}

/** "Rótulo: valor" com o valor em negrito. */
export function Par({ rotulo, valor, className }: { rotulo: string; valor?: ReactNode; className?: string }) {
  return (
    <span className={className}>
      <span className="text-gray-600">{rotulo}: </span>
      <strong>{valor || "—"}</strong>
    </span>
  );
}

/** Linhas de assinatura e "Impresso em". `assinaturas` com um nome só centraliza uma linha. */
export function RodapeAssinaturas({ empresa, assinaturas }: { empresa: Empresa | null; assinaturas: ReactNode[] }) {
  return (
    <footer className="mt-16 break-inside-avoid">
      <div className={cn("grid gap-12 px-10 text-center font-bold", assinaturas.length > 1 ? "grid-cols-2" : "mx-auto w-1/2 grid-cols-1")}>
        {assinaturas.map((a, n) => (
          <div key={n} className="border-t border-gray-500 pt-1">{a}</div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px]">
        <span>{empresa?.nome_fantasia || empresa?.razao_social}</span>
        <strong>Impresso em: {agora()}</strong>
      </div>
    </footer>
  );
}
