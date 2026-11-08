import { Authenticated, Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import { EmConstrucao } from "./app/EmConstrucao";
import { Inicio } from "./app/Inicio";
import { AppShell } from "./app/layout/AppShell";
import { Login } from "./app/Login";
import { authProvider, dataProvider } from "./app/providers";
import { ThemeProvider } from "./app/theme";
import { FuncionarioForm } from "./resources/funcionarios/FuncionarioForm";
import { FuncionariosList } from "./resources/funcionarios/FuncionariosList";
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
              <Route path="ajustes">
                <Route path="funcionarios" element={<FuncionariosList />} />
                <Route path="funcionarios/:id" element={<FuncionarioForm />} />
                <Route path="usuarios" element={<FuncionariosList usuarios />} />
                <Route path="permissoes" element={<Permissoes />} />
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
