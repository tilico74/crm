import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Valor como a API usa: ponto decimal ("78.19"). */
  value: string | number | null | undefined;
  onChange: (valor: string) => void;
  /** Casas decimais mostradas fora da edição (2 para dinheiro, 3 para quantidade). */
  casas?: number;
  /** Texto antes do número fora da edição (ex.: "R$ "). */
  prefixo?: string;
};

/** "78.19" → "78,19"; "1234.5" → "1.234,50". Valor inválido vira 0. */
export const numeroBr = (valor: string | number | null | undefined, casas = 2) => {
  const n = Number(valor);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
};

/** Texto digitado em pt-BR ("1.234,5" ou "2.99") → "1234.5" / "2.99"; null se não for número. */
export function lerNumeroBr(texto: string): string | null {
  const t = texto.trim();
  if (t === "" || t === "-") return "0";
  // Com vírgula, ela é o decimal e os pontos são milhar; sem vírgula, um ponto único é decimal.
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d*(\.\d*)?$/.test(normal) && normal !== "." ? normal.replace(/\.$/, "") || "0" : null;
}

/**
 * Campo de número no padrão brasileiro, como na MarketUP: mostra "R$ 0,05" ou "2,990"
 * e, ao entrar no campo, seleciona tudo (o que se digita substitui o valor). Aceita vírgula.
 * Entrega o valor com ponto decimal, pronto para a API; texto inválido não é aceito.
 */
export function CampoNumero({ value, onChange, casas = 2, prefixo = "", onFocus, onBlur, onMouseUp, ...props }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const acabouDeFocar = useRef(false);
  const selecionar = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  // Seleciona o valor logo depois de trocar "1,000" por "1" (trocar o texto desfaz a seleção).
  useLayoutEffect(() => {
    if (selecionar.current && campo.current) {
      campo.current.select();
      selecionar.current = false;
    }
  }, [editando]);
  const mostrado = editando ?? `${prefixo}${numeroBr(value, casas)}`;

  return (
    <input
      {...props}
      ref={campo}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={mostrado}
      onFocus={(e) => {
        const n = Number(value);
        const texto = Number.isFinite(n) && n !== 0 ? String(value).replace(".", ",") : "";
        setEditando(texto);
        acabouDeFocar.current = true;
        selecionar.current = true;
        // Garante a seleção mesmo se algo redesenhar o campo logo depois do foco (ex.: abertura de modal),
        // mas só se a pessoa ainda não começou a digitar.
        const alvo = e.currentTarget;
        for (const atraso of [0, 50, 150]) {
          window.setTimeout(() => {
            if (document.activeElement === alvo && alvo.value === texto && alvo.selectionStart === alvo.selectionEnd) alvo.select();
          }, atraso);
        }
        onFocus?.(e);
      }}
      // O clique que deu o foco não pode desfazer a seleção do valor.
      onMouseUp={(e) => {
        if (acabouDeFocar.current) {
          e.preventDefault();
          acabouDeFocar.current = false;
        }
        onMouseUp?.(e);
      }}
      onChange={(e) => {
        const texto = e.target.value.replace(/[^\d,.-]/g, "");
        const lido = lerNumeroBr(texto);
        if (lido === null) return;
        setEditando(texto);
        onChange(lido);
      }}
      onBlur={(e) => {
        setEditando(null);
        acabouDeFocar.current = false;
        onBlur?.(e);
      }}
    />
  );
}
