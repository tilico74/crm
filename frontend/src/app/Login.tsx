import { useLogin } from "@refinedev/core";
import { IconEye, IconEyeOff, IconKey, IconUser } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

/** Tela de entrada no modelo da MarketUP: formulário à esquerda, faixa da marca à direita. */
export function Login() {
  const { mutate: login, isPending } = useLogin<{ username: string; password: string }>();
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro("");
    login(
      { username: String(dados.get("username")).trim(), password: String(dados.get("password")) },
      { onSuccess: (r) => !r.success && setErro(r.error?.message ?? "Não foi possível entrar.") },
    );
  };

  const campo =
    "h-12 w-full rounded-xs border border-line bg-surface pl-12 pr-4 text-base text-ink placeholder:text-ink-muted focus:border-brand-cyan focus:outline-none";

  return (
    <div className="flex min-h-dvh bg-surface-raised">
      <main className="flex w-full flex-col px-6 py-8 sm:w-[420px] sm:px-10">
        <img src="/marca/logo-rdx.png" alt="RDX Redes de Proteção" className="h-16 w-auto self-start" />

        <div className="mt-12">
          <p className="text-xs font-semibold uppercase text-primary-dark">Entrar em</p>
          <h1 className="text-xl font-bold uppercase text-primary">RDX Redes de Proteção</h1>
        </div>

        <form onSubmit={enviar} className="mt-8 flex flex-col gap-4" noValidate>
          <label className="relative block">
            <span className="sr-only">Usuário</span>
            <IconUser size={22} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input name="username" autoComplete="username" required placeholder="Usuário" className={campo} />
          </label>

          <label className="relative block">
            <span className="sr-only">Senha</span>
            <IconKey size={22} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              name="password"
              type={verSenha ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Senha"
              className={`${campo} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-0 top-0 flex size-12 items-center justify-center text-ink-muted hover:text-ink"
            >
              {verSenha ? <IconEyeOff size={22} aria-hidden /> : <IconEye size={22} aria-hidden />}
            </button>
          </label>

          {erro && (
            <p role="alert" className="rounded-xs bg-error-soft px-4 py-3 text-sm font-semibold text-error">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 h-12 rounded-xs bg-primary text-base font-bold uppercase text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {isPending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-auto pt-8 text-xs text-ink-muted">
          Esqueceu a senha? Peça ao administrador para trocar em Ajustes › Funcionários.
        </p>
      </main>

      <div aria-hidden className="hidden flex-1 items-end bg-secondary p-12 sm:flex">
        <p className="max-w-md text-3xl font-bold leading-tight text-surface-raised">
          Redes de proteção para janelas, sacadas, piscinas e quadras.
        </p>
      </div>
    </div>
  );
}
