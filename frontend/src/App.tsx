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
              </Route>
              {/* Cada módulo ganha sua rota ao ser construído; até lá, página provisória. */}
              <Route path="*" element={<EmConstrucao />} />
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
