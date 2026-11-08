import { useGetIdentity, useLogout } from "@refinedev/core";
import { IconBell, IconChevronDown, IconLogout, IconMenu2, IconMoon, IconSearch, IconSun } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Me } from "@/lib/api";
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

        <ContaMenu />
      </div>
    </header>
  );
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || nome.slice(0, 2).toUpperCase();

/** Bloco do usuário logado, com o menu "Sair" (como o da MarketUP). */
function ContaMenu() {
  const { data: me } = useGetIdentity<Me>();
  const { mutate: logout } = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nome = me?.nome ?? "";

  useEffect(() => {
    if (!open) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Conta de ${nome}`}
        className="flex h-12 items-center gap-3 rounded-xs px-2 hover:bg-shell-hover"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {iniciais(nome)}
        </span>
        <span className="hidden max-w-[180px] flex-col items-start leading-tight lg:flex">
          <span className="text-[10px] font-bold uppercase text-shell-muted">RDX Redes de Proteção</span>
          <span className="truncate text-sm font-semibold">{nome}</span>
        </span>
        <IconChevronDown size={20} aria-hidden className="hidden lg:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-56 rounded-xs border border-line bg-surface-raised py-1 text-ink shadow-lg">
          <p className="px-4 py-2 text-xs text-ink-muted">
            {me?.grupo ?? (me?.is_superuser ? "Administrador do sistema" : "Sem grupo")}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout()}
            className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold hover:bg-primary-light"
          >
            <IconLogout size={20} aria-hidden />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
