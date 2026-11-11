import type { ComponentType } from "react";
import {
  IconArchiveFilled,
  IconChartDonutFilled,
  IconCirclePlusFilled,
  IconCoinFilled,
  IconFileInvoiceFilled,
  IconHomeFilled,
  IconSettingsFilled,
  IconTagFilled,
  type IconProps,
} from "@tabler/icons-react";

// Menu principal na mesma ordem e com os mesmos nomes da MarketUP.
// Fora do projeto: PDV, loja virtual, restaurantes, conectores (context/00-visao-geral.md).

/** `pagina`: tela que não é listagem (formulário, painel); sem barra de ferramentas. */
/** `novo`: atalho "+" ao lado do item (ex.: Nova conta a pagar), como na MarketUP. */
export type MenuLink = { label: string; path: string; tipo?: "pagina"; novo?: string };
/** `recolhivel`: a seção abre e fecha com a seta (dropdown), como Pagamentos e Recebimentos na MarketUP. */
export type MenuSection = { label: string; links: MenuLink[]; recolhivel?: boolean };

export type MenuGroup = {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  /** Grupo sem subitens: o ícone leva direto para a página. */
  path?: string;
  /** Subitens; um grupo pode ter seções (como Ajustes) ou uma lista simples. */
  sections: MenuSection[];
};

const simple = (links: MenuLink[]): MenuSection[] => [{ label: "", links }];

export const MENU: MenuGroup[] = [
  { id: "inicio", label: "Início", icon: IconHomeFilled, path: "/", sections: [] },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: IconCirclePlusFilled,
    sections: simple([
      { label: "Produtos", path: "/catalogo/produtos" },
      { label: "Serviços", path: "/catalogo/servicos" },
      { label: "Categorias", path: "/catalogo/categorias" },
      { label: "Marcas", path: "/catalogo/marcas" },
      { label: "Unidades de medida", path: "/catalogo/unidades" },
    ]),
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: IconTagFilled,
    sections: simple([
      { label: "Orçamentos", path: "/vendas/orcamentos" },
      { label: "Pedidos", path: "/vendas/pedidos" },
      { label: "Clientes", path: "/vendas/clientes" },
      { label: "CRM", path: "/vendas/crm" },
      { label: "Comissões", path: "/vendas/comissoes" },
      { label: "Lista de preços", path: "/vendas/listas-de-precos" },
      { label: "Ordens de serviço", path: "/vendas/ordens-de-servico" },
    ]),
  },
  {
    id: "estoque",
    label: "Estoque",
    icon: IconArchiveFilled,
    sections: simple([
      { label: "Consulta de estoque", path: "/estoque/consulta" },
      { label: "Movimentações", path: "/estoque/movimentacoes" },
      { label: "Locais de estoque", path: "/estoque/locais" },
      { label: "Tipos de estocagem", path: "/estoque/tipos-de-estocagem" },
      { label: "Inventário", path: "/estoque/inventarios" },
      { label: "Motivo movimentação", path: "/estoque/motivos" },
    ]).concat([
      // Como na MarketUP, Compras fica dentro de Estoque (Orçamentos, Pedidos, Fornecedores, Devoluções, Compras em aberto).
      {
        label: "Compras",
        recolhivel: true,
        links: [
          { label: "Pedidos", path: "/estoque/compras/pedidos", novo: "/estoque/compras/pedidos/novo" },
          { label: "Fornecedores", path: "/estoque/compras/fornecedores", novo: "/estoque/compras/fornecedores/novo" },
          { label: "Compras em aberto", path: "/estoque/compras/em-aberto" },
        ],
      },
    ]),
  },
  {
    id: "notas",
    label: "Notas Fiscais",
    icon: IconFileInvoiceFilled,
    sections: simple([
      { label: "Emitir nota fiscal", path: "/notas/emitir", tipo: "pagina" },
      { label: "Notas recebidas", path: "/notas/recebidas" },
      { label: "Notas emitidas", path: "/notas/emitidas" },
    ]),
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: IconCoinFilled,
    // Como a MarketUP: Pagamentos e Recebimentos abrem a mesma lista com filtros prontos (em aberto / quitadas,
    // vencimento a partir de 3 meses atrás); o "+" de cada item abre uma conta nova.
    sections: [
      {
        label: "",
        links: [
          { label: "Fluxo de caixa", path: "/financeiro/fluxo-de-caixa", tipo: "pagina" },
          { label: "Movimentação de caixa", path: "/financeiro/movimentacao-de-caixa" },
        ],
      },
      {
        label: "Pagamentos",
        recolhivel: true,
        links: [
          { label: "Contas a pagar", path: "/financeiro/contas-a-pagar", novo: "/financeiro/contas-a-pagar/novo" },
          { label: "Contas pagas", path: "/financeiro/contas-pagas", novo: "/financeiro/contas-a-pagar/novo" },
        ],
      },
      {
        label: "Recebimentos",
        recolhivel: true,
        links: [
          { label: "Cobrança (Conta a receber)", path: "/financeiro/contas-a-receber", novo: "/financeiro/contas-a-receber/novo" },
          { label: "Contas recebidas", path: "/financeiro/contas-recebidas", novo: "/financeiro/contas-a-receber/novo" },
        ],
      },
    ],
  },
  { id: "relatorios", label: "Relatórios", icon: IconChartDonutFilled, path: "/relatorios", sections: [] },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: IconSettingsFilled,
    sections: [
      {
        label: "Empresa",
        links: [
          { label: "Informações da empresa", path: "/ajustes/empresa", tipo: "pagina" },
          { label: "Funcionários", path: "/ajustes/funcionarios" },
          { label: "Usuários", path: "/ajustes/usuarios" },
          { label: "Parâmetros de venda", path: "/ajustes/parametros-de-venda", tipo: "pagina" },
          { label: "Permissões", path: "/ajustes/permissoes", tipo: "pagina" },
        ],
      },
      {
        label: "Financeiro",
        links: [
          { label: "Conta gerencial", path: "/ajustes/contas-gerenciais" },
          { label: "Conta corrente", path: "/ajustes/contas-correntes" },
          { label: "Tipos de pagamento", path: "/ajustes/tipos-de-pagamento" },
        ],
      },
      {
        label: "Pessoas",
        links: [{ label: "Tipos de fornecedor", path: "/ajustes/tipos-de-fornecedor" }],
      },
    ],
  },
];

/** Grupo e item de menu da rota atual (para destacar o grupo e montar o título da página). */
export function findMenuItem(pathname: string): { group: MenuGroup; link?: MenuLink } | undefined {
  for (const group of MENU) {
    if (group.path && group.path === pathname) return { group };
    for (const section of group.sections) {
      const link = section.links.find((l) => l.path === pathname);
      if (link) return { group, link };
    }
  }
  return undefined;
}

/** Funcionalidade da matriz de permissões que libera cada rota (codigos do back-end). */
const FUNCIONALIDADE_POR_ROTA: Record<string, string> = {
  "/catalogo/produtos": "produtos",
  "/catalogo/servicos": "servicos",
  "/catalogo/categorias": "categorias",
  "/catalogo/marcas": "marcas",
  "/catalogo/unidades": "unidades",
  "/vendas/orcamentos": "orcamentos",
  "/vendas/pedidos": "pedidos",
  "/vendas/clientes": "clientes",
  "/vendas/crm": "crm",
  "/vendas/comissoes": "comissoes_lancamento",
  "/vendas/comissoes/aprovacao": "comissoes_aprovacao",
  "/vendas/listas-de-precos": "listas_precos",
  "/vendas/ordens-de-servico": "ordens_servico",
  "/estoque/consulta": "consulta_estoque",
  "/estoque/movimentacoes": "movimentacoes_estoque",
  "/estoque/locais": "locais_estoque",
  "/estoque/inventarios": "locais_estoque",
  "/estoque/tipos-de-estocagem": "tipos_estocagem",
  "/estoque/motivos": "motivos_movimentacao",
  "/estoque/compras/fornecedores": "fornecedores",
  "/estoque/compras/pedidos": "pedidos_compra",
  "/estoque/compras/em-aberto": "pedidos_compra",
  "/notas/emitir": "notas_fiscais",
  "/notas/recebidas": "notas_fiscais",
  "/notas/emitidas": "notas_fiscais",
  "/financeiro/fluxo-de-caixa": "fluxo_caixa",
  "/financeiro/movimentacao-de-caixa": "movimentacao_caixa",
  "/financeiro/contas-a-pagar": "contas_pagar",
  "/financeiro/contas-pagas": "contas_pagar",
  "/financeiro/contas-a-receber": "contas_receber",
  "/financeiro/contas-recebidas": "contas_receber",
  "/relatorios": "relatorios",
  "/ajustes/empresa": "empresa",
  "/ajustes/funcionarios": "funcionarios",
  "/ajustes/usuarios": "funcionarios",
  "/ajustes/parametros-de-venda": "parametros_venda",
  "/ajustes/permissoes": "permissoes",
  "/ajustes/contas-gerenciais": "contas_gerenciais",
  "/ajustes/contas-correntes": "contas_correntes",
  "/ajustes/tipos-de-pagamento": "tipos_pagamento",
  "/ajustes/tipos-de-fornecedor": "tipos_fornecedor",
};

export type Permissoes = Record<string, string[]>;

/** A pessoa pode fazer `acao` na rota? Rotas sem funcionalidade (Início) são livres. */
export function pode(permissoes: Permissoes | undefined, path: string, acao = "acessar"): boolean {
  const codigo = FUNCIONALIDADE_POR_ROTA[path.replace(/\/(novo|\d+)$/, "")];
  if (!codigo) return true;
  return permissoes?.[codigo]?.includes(acao) ?? false;
}

/** Menu só com o que a pessoa pode acessar; grupos sem itens somem. */
export function menuPermitido(permissoes: Permissoes | undefined): MenuGroup[] {
  return MENU.flatMap((group) => {
    if (group.path) return pode(permissoes, group.path) ? [group] : [];
    const sections = group.sections
      .map((s) => ({ ...s, links: s.links.filter((l) => pode(permissoes, l.path)) }))
      .filter((s) => s.links.length > 0);
    return sections.length ? [{ ...group, sections }] : [];
  });
}
