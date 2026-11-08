import type { AuthProvider, DataProvider, HttpError } from "@refinedev/core";

import { api, ApiError, getTokens, login, setTokens, type Me } from "@/lib/api";

const toHttpError = (error: unknown): HttpError => {
  if (error instanceof ApiError) {
    const errors = Object.fromEntries(
      Object.entries(error.errors).map(([campo, msg]) => [campo, Array.isArray(msg) ? msg : [msg]]),
    );
    return { message: error.message, statusCode: error.status, errors };
  }
  return { message: "Não foi possível falar com o servidor.", statusCode: 0 };
};

const call = async <T>(path: string, init?: RequestInit) => {
  try {
    return await api<T>(path, init);
  } catch (error) {
    throw toHttpError(error);
  }
};

/** Adaptador do Refine para a API Django REST Framework (paginação count/results). */
export const dataProvider: DataProvider = {
  getApiUrl: () => import.meta.env.VITE_API_URL,

  getList: async ({ resource, pagination, sorters, filters, meta }) => {
    const params = new URLSearchParams();
    const pageSize = pagination?.pageSize ?? 25;
    params.set("page", String(pagination?.currentPage ?? 1));
    params.set("page_size", String(pageSize));
    const ordering = sorters?.map((s) => (s.order === "desc" ? "-" : "") + s.field).join(",");
    if (ordering) params.set("ordering", ordering);
    for (const filter of filters ?? []) {
      if ("field" in filter && filter.value !== undefined && filter.value !== "") {
        params.set(filter.field === "q" ? "search" : filter.field, String(filter.value));
      }
    }
    for (const [key, value] of Object.entries(meta?.params ?? {})) params.set(key, String(value));

    const body = await call<{ count: number; results: never[] } | never[]>(`/${resource}?${params}`);
    if (Array.isArray(body)) return { data: body, total: body.length };
    return { data: body.results, total: body.count };
  },

  getOne: async ({ resource, id }) => ({ data: await call(`/${resource}/${id}`) }),

  create: async ({ resource, variables }) => ({
    data: await call(`/${resource}`, { method: "POST", body: JSON.stringify(variables) }),
  }),

  update: async ({ resource, id, variables }) => ({
    data: await call(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(variables) }),
  }),

  deleteOne: async ({ resource, id }) => {
    await call(`/${resource}/${id}`, { method: "DELETE" });
    return { data: { id } as never };
  },

  custom: async ({ url, method, payload }) => ({
    data: await call(url, { method: method.toUpperCase(), body: payload ? JSON.stringify(payload) : undefined }),
  }),
};

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    try {
      await login(username, password);
      return { success: true, redirectTo: "/" };
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 401
          ? "Login ou senha incorretos."
          : "Não foi possível entrar. Tente de novo.";
      return { success: false, error: { name: "Login", message } };
    }
  },
  logout: async () => {
    setTokens(null);
    return { success: true, redirectTo: "/login" };
  },
  check: async () => (getTokens() ? { authenticated: true } : { authenticated: false, redirectTo: "/login" }),
  onError: async (error) => (error?.statusCode === 401 ? { logout: true, redirectTo: "/login" } : {}),
  getIdentity: async () => (getTokens() ? api<Me>("/auth/me") : null),
};
