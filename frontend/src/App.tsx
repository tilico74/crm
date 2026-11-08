import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import dataProvider from "@refinedev/simple-rest";
import { BrowserRouter, Route, Routes } from "react-router";

import { EmConstrucao } from "./app/EmConstrucao";
import { Inicio } from "./app/Inicio";
import { AppShell } from "./app/layout/AppShell";
import { ThemeProvider } from "./app/theme";

// Provedor de dados provisório: o adaptador para a API Django entra com o primeiro módulo.
const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Refine
          dataProvider={dataProvider(API_URL)}
          routerProvider={routerProvider}
          options={{ disableTelemetry: true }}
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Inicio />} />
              {/* Cada módulo ganha sua rota ao ser construído; até lá, página provisória. */}
              <Route path="*" element={<EmConstrucao />} />
            </Route>
          </Routes>
        </Refine>
      </BrowserRouter>
    </ThemeProvider>
  );
}
