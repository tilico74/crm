import { Authenticated, Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import { EmConstrucao } from "./app/EmConstrucao";
import { Inicio } from "./app/Inicio";
import { AppShell } from "./app/layout/AppShell";
import { Login } from "./app/Login";
import { authProvider, dataProvider } from "./app/providers";
import { ThemeProvider } from "./app/theme";
import { CategoriaForm } from "./resources/catalogo/CategoriaForm";
import { CategoriasList } from "./resources/catalogo/CategoriasList";
import { MarcasList } from "./resources/catalogo/MarcasList";
import { ProdutoForm } from "./resources/catalogo/ProdutoForm";
import { ProdutosList } from "./resources/catalogo/ProdutosList";
import { ServicoForm } from "./resources/catalogo/ServicoForm";
import { ServicosList } from "./resources/catalogo/ServicosList";
import { UnidadesList } from "./resources/catalogo/UnidadesList";
import { ClienteForm } from "./resources/clientes/ClienteForm";
import { ClientesList } from "./resources/clientes/ClientesList";
import { ListaPrecoForm } from "./resources/clientes/ListaPrecoForm";
import { ListasPrecosList } from "./resources/clientes/ListasPrecosList";
import { OrcamentoForm, PedidoForm } from "./resources/orcamentos/OrcamentoForm";
import { DocumentoImpressao, OrcamentoImpressao } from "./resources/orcamentos/OrcamentoImpressao";
import { PedidosList } from "./resources/pedidos/PedidosList";
import { ComissaoForm } from "./resources/comissoes/ComissaoForm";
import { ComissoesList } from "./resources/comissoes/ComissoesList";
import { FechamentoForm, FechamentosList } from "./resources/comissoes/Aprovacao";
import { BaixarVarias } from "./resources/financeiro/BaixarVarias";
import { FornecedorForm } from "./resources/compras/FornecedorForm";
import { PedidoCompraForm } from "./resources/compras/PedidoCompraForm";
import { PedidoCompraImpressao } from "./resources/compras/PedidoCompraImpressao";
import { PedidosCompraList } from "./resources/compras/PedidosCompraList";
import { FornecedoresList, TiposFornecedorList } from "./resources/compras/FornecedoresList";
import { MotivosList, TiposEstocagemList } from "./resources/estoque/Cadastros";
import { ConsultaEstoque } from "./resources/estoque/Consulta";
import { InventarioForm, LocaisList, LocalForm } from "./resources/estoque/Locais";
import { MovimentacaoForm, MovimentacoesList } from "./resources/estoque/Movimentacoes";
import { FluxoCaixa } from "./resources/financeiro/FluxoCaixa";
import { Movimentacao } from "./resources/financeiro/Movimentacao";
import { ContaPagarForm, ContaReceberForm } from "./resources/financeiro/TituloForm";
import { TitulosList } from "./resources/financeiro/TitulosList";
import { ReciboImpressao } from "./resources/pedidos/ReciboImpressao";
import { OrcamentosList } from "./resources/orcamentos/OrcamentosList";
import { InformacoesEmpresa } from "./resources/empresa/InformacoesEmpresa";
import { ParametrosVenda } from "./resources/empresa/ParametrosVenda";
import { ContaGerencialForm } from "./resources/financeiro/ContaGerencialForm";
import { ContasCorrentesList } from "./resources/financeiro/ContasCorrentesList";
import { ContasGerenciaisList } from "./resources/financeiro/ContasGerenciaisList";
import { TipoPagamentoForm } from "./resources/financeiro/TipoPagamentoForm";
import { TiposPagamentoList } from "./resources/financeiro/TiposPagamentoList";
import { FuncionarioForm } from "./resources/funcionarios/FuncionarioForm";
import { FuncionariosList } from "./resources/funcionarios/FuncionariosList";
import { UsuariosList } from "./resources/funcionarios/UsuariosList";
import { Permissoes } from "./resources/permissoes/Permissoes";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Refine
          dataProvider={dataProvider}
          authProvider={authProvider}
          routerProvider={routerProvider}
          options={{ disableTelemetry: true }}
        >
          <Routes>
            <Route
              element={
                <Authenticated key="app" fallback={<Navigate to="/login" replace />}>
                  <AppShell />
                </Authenticated>
              }
            >
              <Route index element={<Inicio />} />
              <Route path="catalogo">
                <Route path="produtos" element={<ProdutosList />} />
                <Route path="produtos/:id" element={<ProdutoForm />} />
                <Route path="servicos" element={<ServicosList />} />
                <Route path="servicos/:id" element={<ServicoForm />} />
                <Route path="unidades" element={<UnidadesList />} />
                <Route path="marcas" element={<MarcasList />} />
                <Route path="categorias" element={<CategoriasList />} />
                <Route path="categorias/:id" element={<CategoriaForm />} />
              </Route>
              <Route path="vendas">
                <Route path="clientes" element={<ClientesList />} />
                <Route path="clientes/:id" element={<ClienteForm />} />
                <Route path="listas-de-precos" element={<ListasPrecosList />} />
                <Route path="listas-de-precos/:id" element={<ListaPrecoForm />} />
                <Route path="orcamentos" element={<OrcamentosList />} />
                <Route path="orcamentos/:id" element={<OrcamentoForm />} />
                <Route path="pedidos" element={<PedidosList />} />
                <Route path="pedidos/:id" element={<PedidoForm />} />
                <Route path="comissoes" element={<ComissoesList />} />
                <Route path="comissoes/aprovacao" element={<FechamentosList />} />
                <Route path="comissoes/aprovacao/:id" element={<FechamentoForm />} />
                <Route path="comissoes/:id" element={<ComissaoForm />} />
              </Route>
              <Route path="financeiro">
                <Route path="contas-a-receber" element={<TitulosList lado="receber" key="receber" />} />
                <Route path="contas-a-receber/baixar" element={<BaixarVarias lado="receber" />} />
                <Route path="contas-a-receber/:id" element={<ContaReceberForm />} />
                <Route path="contas-a-pagar" element={<TitulosList lado="pagar" key="pagar" />} />
                <Route path="contas-pagas" element={<TitulosList lado="pagar" quitadasInicial="1" titulo="Contas pagas" key="pagas" />} />
                <Route path="contas-recebidas" element={<TitulosList lado="receber" quitadasInicial="1" titulo="Contas recebidas" key="recebidas" />} />
                <Route path="contas-a-pagar/baixar" element={<BaixarVarias lado="pagar" />} />
                <Route path="contas-a-pagar/:id" element={<ContaPagarForm />} />
                <Route path="movimentacao-de-caixa" element={<Movimentacao />} />
                <Route path="fluxo-de-caixa" element={<FluxoCaixa />} />
              </Route>
              <Route path="estoque">
                <Route path="consulta" element={<ConsultaEstoque />} />
                <Route path="movimentacoes" element={<MovimentacoesList />} />
                <Route path="movimentacoes/:id" element={<MovimentacaoForm />} />
                <Route path="locais" element={<LocaisList />} />
                <Route path="locais/:id" element={<LocalForm />} />
                <Route path="inventarios" element={<LocaisList />} />
                <Route path="inventarios/:id" element={<InventarioForm />} />
                <Route path="tipos-de-estocagem" element={<TiposEstocagemList />} />
                <Route path="motivos" element={<MotivosList />} />
                <Route path="compras/fornecedores" element={<FornecedoresList />} />
                <Route path="compras/fornecedores/:id" element={<FornecedorForm />} />
                <Route path="compras/pedidos" element={<PedidosCompraList />} />
                <Route path="compras/pedidos/:id" element={<PedidoCompraForm />} />
                <Route path="compras/em-aberto" element={<PedidosCompraList key="em-aberto" aReceber />} />
              </Route>
              <Route path="ajustes">
                <Route path="funcionarios" element={<FuncionariosList />} />
                <Route path="funcionarios/:id" element={<FuncionarioForm />} />
                <Route path="usuarios" element={<UsuariosList />} />
                <Route path="permissoes" element={<Permissoes />} />
                <Route path="empresa" element={<InformacoesEmpresa />} />
                <Route path="parametros-de-venda" element={<ParametrosVenda />} />
                <Route path="contas-gerenciais" element={<ContasGerenciaisList />} />
                <Route path="contas-gerenciais/:id" element={<ContaGerencialForm />} />
                <Route path="contas-correntes" element={<ContasCorrentesList />} />
                <Route path="tipos-de-pagamento" element={<TiposPagamentoList />} />
                <Route path="tipos-de-pagamento/:id" element={<TipoPagamentoForm />} />
                <Route path="tipos-de-fornecedor" element={<TiposFornecedorList />} />
              </Route>
              {/* Cada módulo ganha sua rota ao ser construído; até lá, página provisória. */}
              <Route path="*" element={<EmConstrucao />} />
            </Route>

            {/* Impressões: fora do layout (sem menus), em A4. */}
            <Route
              element={
                <Authenticated key="impressao" fallback={<Navigate to="/login" replace />}>
                  <Outlet />
                </Authenticated>
              }
            >
              <Route path="vendas/orcamentos/:id/imprimir" element={<OrcamentoImpressao />} />
              <Route path="vendas/pedidos/:id/imprimir" element={<DocumentoImpressao tipo="pedido" />} />
              <Route path="estoque/compras/pedidos/:id/imprimir" element={<PedidoCompraImpressao />} />
              <Route path="vendas/recibos/:conta/imprimir" element={<ReciboImpressao />} />
            </Route>

            <Route
              element={
                <Authenticated key="login" fallback={<Outlet />}>
                  <Navigate to="/" replace />
                </Authenticated>
              }
            >
              <Route path="login" element={<Login />} />
            </Route>
          </Routes>
        </Refine>
      </BrowserRouter>
    </ThemeProvider>
  );
}
