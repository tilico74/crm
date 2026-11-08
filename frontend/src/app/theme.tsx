import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "claro" | "escuro";

const STORAGE_KEY = "rdx-tema";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "claro" || saved === "escuro") return saved;
  } catch {
    // Armazenamento bloqueado: segue o tema do sistema.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "claro",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "escuro");
  }, [theme]);

  const toggle = () =>
    setTheme((current) => {
      const next = current === "claro" ? "escuro" : "claro";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sem armazenamento: o tema vale só nesta visita.
      }
      return next;
    });

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
