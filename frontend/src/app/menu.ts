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
export type MenuLink = { label: string; path: string; tipo?: "pagina" };
export type MenuSection = { label: string; links: MenuLink[] };

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
      { label: "Motivo movimentação", path: "/estoque/motivos" },
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
    sections: simple([
      { label: "Fluxo de caixa", path: "/financeiro/fluxo-de-caixa", tipo: "pagina" },
      { label: "Movimentação de caixa", path: "/financeiro/movimentacao-de-caixa" },
      { label: "Contas a pagar", path: "/financeiro/contas-a-pagar" },
      { label: "Contas a receber", path: "/financeiro/contas-a-receber" },
    ]),
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
