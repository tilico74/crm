import { IconBell, IconChevronDown, IconMenu2, IconMoon, IconSearch, IconSun } from "@tabler/icons-react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

import { useTheme } from "../theme";

const iconButton =
  "inline-flex size-12 shrink-0 items-center justify-center rounded-xs text-shell-ink hover:bg-shell-hover";

/** Barra superior de 64px, como a da MarketUP: logo, busca, avisos e usuário. */
export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-2 border-b border-shell-line bg-shell-top px-2 text-shell-ink lg:gap-4 lg:px-6">
      <button type="button" className={`${iconButton} lg:hidden`} onClick={onOpenMenu} aria-label="Abrir menu">
        <IconMenu2 size={24} aria-hidden />
      </button>

      {/* A logo tem letras escuras: fica sobre um fundo branco, como no painel interno. */}
      <Link to="/" className="flex h-11 shrink-0 items-center rounded-xs bg-white px-2" aria-label="RDX — início">
        <img src="/marca/logo-rdx.png" alt="RDX Redes de Proteção" className="h-9 w-auto" />
      </Link>

      <form
        role="search"
        className="ml-2 hidden h-11 max-w-[510px] flex-1 items-center gap-3 rounded-md bg-shell-rail px-4 md:flex lg:ml-10"
        onSubmit={(e) => e.preventDefault()}
      >
        <IconSearch size={20} aria-hidden className="text-shell-muted" />
        <input
          type="search"
          placeholder="Procure por..."
          aria-label="Procurar"
          className="h-full w-full bg-transparent text-sm text-shell-ink placeholder:text-shell-muted focus:outline-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" className={`${iconButton} md:hidden`} aria-label="Procurar">
          <IconSearch size={22} aria-hidden />
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={toggle}
          aria-label={theme === "claro" ? "Usar tema escuro" : "Usar tema claro"}
          title={theme === "claro" ? "Tema escuro" : "Tema claro"}
        >
          {theme === "claro" ? <IconMoon size={22} aria-hidden /> : <IconSun size={22} aria-hidden />}
        </button>
        <button type="button" className={cn(iconButton, "hidden sm:inline-flex")} aria-label="Notificações">
          <IconBell size={22} aria-hidden />
        </button>

        {/* Usuário logado entra na T101; por enquanto mostra só a empresa. */}
        <button type="button" className="flex h-12 items-center gap-3 rounded-xs px-2 hover:bg-shell-hover" aria-label="Conta">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            RD
          </span>
          <span className="hidden flex-col items-start leading-tight lg:flex">
            <span className="text-[10px] font-bold uppercase text-shell-muted">RDX Redes de Proteção</span>
            <span className="text-sm font-semibold">Usuário</span>
          </span>
          <IconChevronDown size={20} aria-hidden className="hidden lg:block" />
        </button>
      </div>
    </header>
  );
}
