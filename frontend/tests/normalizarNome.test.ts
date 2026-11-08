import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizarNome, PARTICULAS, ROMANOS, SIGLAS } from "@/lib/normalizarNome";

type Casos = {
  particulas: string[];
  siglas: string[];
  romanos: string[];
  casos: { entrada: string; esperado: string }[];
};

// Montado pelo docker-compose.yml a partir de skills/normalizar-nomes/casos.json.
const casos: Casos = JSON.parse(readFileSync("/casos/normalizar-nomes.json", "utf-8"));

describe("normalizarNome", () => {
  it.each(casos.casos)("$entrada → $esperado", ({ entrada, esperado }) => {
    expect(normalizarNome(entrada)).toBe(esperado);
  });

  it.each(casos.casos)("é idempotente: $esperado", ({ esperado }) => {
    expect(normalizarNome(esperado)).toBe(esperado);
  });

  it("usa as mesmas listas do casos.json", () => {
    expect(PARTICULAS).toEqual(new Set(casos.particulas));
    expect(SIGLAS).toEqual(new Set(casos.siglas));
    expect(ROMANOS).toEqual(new Set(casos.romanos));
  });

  it("nulo continua nulo", () => {
    expect(normalizarNome(null)).toBeNull();
  });
});
