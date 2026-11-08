import { useState } from "react";
import { Outlet } from "react-router";

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
        <Outlet />
      </main>
    </div>
  );
}
