import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CepField } from "@/components/CepField";
import { ApiError } from "@/lib/api";
import * as localidades from "@/lib/localidades";
import { camposDoCep } from "@/lib/localidades";

const SE = { cep: "01001-000", logradouro: "Praça da Sé", complemento: "lado ímpar", bairro: "Sé", cidade: "São Paulo", uf: "SP", ibge: "3550308", ddd: "11" };

function Formulario({ aoPreencher }: { aoPreencher: (e: object) => void }) {
  const [cep, setCep] = useState("");
  return <CepField value={cep} onChange={setCep} onEndereco={(e) => aoPreencher(camposDoCep(e))} />;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CepField", () => {
  it("mostra a máscara e busca ao completar 8 dígitos, sem esperar sair do campo", async () => {
    const consulta = vi.spyOn(localidades, "consultarCep").mockResolvedValue(SE);
    const aoPreencher = vi.fn();
    render(<Formulario aoPreencher={aoPreencher} />);
    const campo = screen.getByLabelText("CEP") as HTMLInputElement;

    fireEvent.change(campo, { target: { value: "0100100" } });
    expect(campo.value).toBe("01001-00");
    expect(consulta).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(campo, { target: { value: "01001-000" } });
    });
    expect(consulta).toHaveBeenCalledWith("01001000");
    expect(aoPreencher).toHaveBeenCalledWith({ logradouro: "Praça da Sé", bairro: "Sé", cidade: "São Paulo", uf: "SP", ibge: "3550308" });
  });

  it("CEP não encontrado mostra o aviso e não preenche nada", async () => {
    vi.spyOn(localidades, "consultarCep").mockRejectedValue(new ApiError(404, { detail: "CEP não encontrado. Confira o número ou preencha o endereço manualmente." }));
    const aoPreencher = vi.fn();
    render(<Formulario aoPreencher={aoPreencher} />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "99999999" } });
    });
    expect(screen.getByText(/CEP não encontrado/)).toBeTruthy();
    expect(aoPreencher).not.toHaveBeenCalled();
  });
});
