// Cliente da API Django com login JWT (SimpleJWT).

const API_URL = import.meta.env.VITE_API_URL;
const TOKENS_KEY = "rdx-tokens";

type Tokens = { access: string; refresh: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    /** Erros por campo devolvidos pelo DRF ({ campo: ["mensagem"] }). */
    public errors: Record<string, string[] | string> = {},
  ) {
    super(ApiError.messageFor(status, errors));
  }

  static messageFor(status: number, errors: Record<string, string[] | string>) {
    if (status === 401) return "Sua sessão expirou. Entre de novo.";
    if (status === 403) return "Você não tem permissão para fazer isso.";
    const detail = errors.detail ?? errors.non_field_errors;
    if (detail) return Array.isArray(detail) ? detail.join(" ") : detail;
    if (status >= 500) return "O servidor falhou. Tente de novo em instantes.";
    return "Confira os campos destacados.";
  }
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  try {
    if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    // Sem armazenamento: o login vale só enquanto a aba estiver aberta.
  }
}

async function parse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function refreshAccess(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  const response = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });
  if (!response.ok) {
    setTokens(null);
    return false;
  }
  const { access } = await response.json();
  setTokens({ ...tokens, access });
  return true;
}

/** Chama a API com o token; renova o token uma vez se ele tiver vencido. */
export async function api<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && (await refreshAccess())) {
    return api<T>(path, init, false);
  }
  const body = await parse(response);
  if (!response.ok) throw new ApiError(response.status, body ?? {});
  return body as T;
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new ApiError(response.status, (await parse(response)) ?? {});
  setTokens(await response.json());
}

export type Me = {
  id: number;
  username: string;
  nome: string;
  grupo: string | null;
  is_superuser: boolean;
  permissoes: Record<string, string[]>;
};
