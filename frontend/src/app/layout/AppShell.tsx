import { useState } from "react";
import { Outlet, useLocation } from "react-router";

import { PageHeader } from "@/components/PageHeader";

import { useMe } from "../useMe";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

/** Estrutura de todas as telas: barra superior, menu lateral e área de conteúdo. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-surface-raised">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <TopBar onOpenMenu={() => setMenuOpen(true)} />
      <SideNav open={menuOpen} onOpenChange={setMenuOpen} />
      {/* pb-20 no celular: espaço para o botão principal fixo embaixo. */}
      <main id="conteudo" className="pb-20 pt-16 md:pb-0 lg:pl-[88px]">
        <RotaPermitida />
      </main>
    </div>
  );
}

/** Tela sem permissão de acesso (endereço digitado direto) mostra aviso em vez do conteúdo. */
function RotaPermitida() {
  const { pathname } = useLocation();
  const { me, pode } = useMe();
  if (!me) return null;
  if (pode(pathname)) return <Outlet />;
  return (
    <>
      <PageHeader eyebrow="RDX" title="Sem permissão" />
      <p className="mx-auto max-w-[992px] px-4 py-10 text-ink-muted xl:px-0">
        Seu grupo não tem acesso a esta tela. Peça ao administrador para liberar em Ajustes › Permissões.
      </p>
    </>
  );
}
