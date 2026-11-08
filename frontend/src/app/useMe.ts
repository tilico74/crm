import { useGetIdentity } from "@refinedev/core";

import type { Me } from "@/lib/api";

import { pode } from "./menu";

/** Usuário logado e um atalho para conferir permissões da rota. */
export function useMe() {
  const { data: me } = useGetIdentity<Me>();
  return { me, pode: (path: string, acao = "acessar") => !!me && pode(me.permissoes, path, acao) };
}
