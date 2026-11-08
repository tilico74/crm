import { PageHeader } from "@/components/PageHeader";

export function Inicio() {
  return (
    <>
      <PageHeader eyebrow="RDX Redes de Proteção" title="Início" />
      <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted xl:px-0">
        O painel com vendas, financeiro e estoque entra quando esses módulos estiverem prontos.
      </p>
    </>
  );
}
