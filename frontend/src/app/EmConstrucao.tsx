import { useLocation } from "react-router";

import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";

import { findMenuItem } from "./menu";

/** Página provisória de cada item do menu, até o módulo ser construído. */
export function EmConstrucao() {
  const { pathname } = useLocation();
  const item = findMenuItem(pathname);

  if (!item) {
    return (
      <>
        <PageHeader eyebrow="RDX" title="Página não encontrada" />
        <Aviso texto="O endereço digitado não existe. Use o menu ao lado." />
      </>
    );
  }

  const title = item.link?.label ?? item.group.label;
  const isList = item.link && item.link.tipo !== "pagina";

  return (
    <>
      <PageHeader eyebrow={item.group.label} title={title}>
        {isList ? <ListToolbar preview /> : undefined}
      </PageHeader>
      <Aviso texto="Esta tela ainda está em construção." />
    </>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted xl:px-0">{texto}</p>;
}
