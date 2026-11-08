import { useGetIdentity } from "@refinedev/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";

import type { Me } from "@/lib/api";
import { cn } from "@/lib/utils";

import { findMenuItem, menuPermitido, type MenuGroup } from "../menu";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Menu lateral no modelo da MarketUP:
 * - fechado: trilho de 88px só com ícones;
 * - ao passar o mouse (ou clicar) num grupo: o trilho abre com os nomes e um segundo painel
 *   mostra os subitens; ao tirar o mouse do menu, ele fecha sozinho;
 * - celular e tablet: gaveta que abre pelo botão da barra superior, com subitens embaixo do grupo.
 */

/** Abrir ao passar o mouse só vale no computador, com mouse de verdade. */
const canHover = () => window.matchMedia("(hover: hover) and (min-width: 1024px)").matches;

// Pequenas esperas evitam abrir quando o mouse só cruza o menu e fechar num tremor da mão.
const OPEN_DELAY = 120;
const CLOSE_DELAY = 250;
export function SideNav({ open, onOpenChange }: Props) {
  const { pathname } = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const currentGroup = findMenuItem(pathname)?.group.id;
  const { data: me } = useGetIdentity<Me>();
  const menu = menuPermitido(me?.permissoes);
  const selectedGroup = menu.find((g) => g.id === selected);

  const close = () => {
    setSelected(null);
    onOpenChange(false);
  };

  // Fecha ao trocar de página.
  useEffect(close, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const timer = useRef<number | undefined>(undefined);
  const schedule = (fn: () => void, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, delay);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const choose = (group: MenuGroup) => {
    window.clearTimeout(timer.current);
    // Com mouse, o grupo já abriu ao passar por cima: o clique não fecha.
    if (open && selected === group.id && !canHover()) {
      close();
      return;
    }
    setSelected(group.id);
    onOpenChange(true);
  };

  const hoverGroup = (group: MenuGroup) => {
    if (!canHover()) return;
    const show = () => {
      setSelected(group.path ? null : group.id);
      onOpenChange(true);
    };
    if (open) {
      window.clearTimeout(timer.current);
      show();
    } else {
      schedule(show, OPEN_DELAY);
    }
  };

  const hoverMenu = (inside: boolean) => {
    if (!canHover()) return;
    if (inside) {
      if (open) window.clearTimeout(timer.current);
    } else {
      schedule(close, CLOSE_DELAY);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-20 bg-black/40 lg:bg-transparent" onClick={close} aria-hidden />
      )}

      <nav
        aria-label="Menu principal"
        onMouseEnter={() => hoverMenu(true)}
        onMouseLeave={() => hoverMenu(false)}
        className={cn("fixed bottom-0 left-0 top-16 z-30", open ? "flex" : "hidden lg:flex")}
      >
        <ul
          className={cn(
            "flex flex-col gap-2 overflow-y-auto bg-shell-rail py-5 [scrollbar-color:var(--rdx-shell-line)_transparent] [scrollbar-width:thin]",
            open ? "w-[min(320px,85vw)] px-5 lg:w-[230px]" : "w-[88px] items-center",
          )}
        >
          {menu.map((group) => {
            const Icon = group.icon;
            const isCurrent = currentGroup === group.id;
            const isSelected = selected === group.id;
            const itemClass = cn(
              "flex h-12 shrink-0 items-center gap-3 rounded-md text-shell-ink hover:bg-shell-hover",
              open ? "w-full px-3" : "w-12 justify-center",
              isSelected && "bg-shell-hover",
              isCurrent && "bg-primary text-primary-foreground hover:bg-primary-dark",
            );
            const label = open && <span className="flex-1 whitespace-nowrap text-left text-sm font-semibold">{group.label}</span>;

            return (
              <li key={group.id} onMouseEnter={() => hoverGroup(group)}>
                {group.path ? (
                  <Link to={group.path} className={itemClass} aria-label={open ? undefined : group.label} title={open ? undefined : group.label}>
                    <Icon size={24} aria-hidden />
                    {label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={itemClass}
                    onClick={() => choose(group)}
                    aria-expanded={open && isSelected}
                    aria-controls="submenu"
                    aria-label={open ? undefined : group.label}
                    title={open ? undefined : group.label}
                  >
                    <Icon size={24} aria-hidden />
                    {label}
                    {open &&
                      (isSelected ? <IconChevronLeft size={20} aria-hidden /> : <IconChevronRight size={20} aria-hidden />)}
                  </button>
                )}

                {/* Celular e tablet: subitens embaixo do grupo. */}
                {open && isSelected && (
                  <div className="lg:hidden">
                    <Submenu group={group} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Computador: subitens num segundo painel ao lado, como na MarketUP. */}
        {open && selectedGroup && selectedGroup.sections.length > 0 && (
          <div id="submenu" className="hidden w-[220px] overflow-y-auto bg-shell-panel py-5 lg:block">
            <Submenu group={selectedGroup} />
          </div>
        )}
      </nav>
    </>
  );
}

function Submenu({ group }: { group: MenuGroup }) {
  return (
    <>
      {group.sections.map((section) => (
        <div key={section.label || group.id} className="mb-2">
          {section.label && (
            <p className="px-6 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-shell-muted">{section.label}</p>
          )}
          <ul>
            {section.links.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center border-l-4 border-transparent px-6 text-sm font-semibold text-shell-ink/85 hover:bg-shell-hover hover:text-shell-ink",
                      isActive && "border-brand-cyan bg-shell-hover text-shell-ink",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
