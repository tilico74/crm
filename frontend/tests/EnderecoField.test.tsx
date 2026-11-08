import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EnderecoField } from "@/components/EnderecoField";
import * as localidades from "@/lib/localidades";
import type { EnderecoCep } from "@/lib/localidades";

const RUA: EnderecoCep = {
  cep: "88138-152", logradouro: "Rua José Pedro Correia Filho", complemento: "", bairro: "Praia do Pontal",
  cidade: "Palhoça", uf: "SC", ibge: "4211900", ddd: "48",
};

beforeAll(() => {
  // jsdom não implementa <dialog>.showModal.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Formulario({ aoEscolher }: { aoEscolher: (e: EnderecoCep) => void }) {
  const [rua, setRua] = useState("");
  return <EnderecoField value={rua} onChange={setRua} onEndereco={aoEscolher} />;
}

describe("EnderecoField + BuscaEnderecoModal", () => {
  it("lupa abre o modal; UF, cidade e 3 letras listam endereços; clicar escolhe e fecha", async () => {
    vi.spyOn(localidades, "listarEstados").mockResolvedValue([{ id: 42, sigla: "SC", nome: "Santa Catarina", regiao: "Sul" }]);
    vi.spyOn(localidades, "listarMunicipios").mockResolvedValue([{ id: 4211900, nome: "Palhoça" }]);
    const pesquisa = vi.spyOn(localidades, "pesquisarEnderecos").mockResolvedValue([RUA]);
    const aoEscolher = vi.fn();
    render(<Formulario aoEscolher={aoEscolher} />);

    fireEvent.click(screen.getByRole("button", { name: /pesquisar endereço/i }));
    const dialogo = await screen.findByRole("dialog");

    await screen.findByRole("option", { name: "SC" });
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "SC" } });
    await screen.findByRole("option", { name: "Palhoça" });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Palhoça" } });

    const termo = screen.getAllByLabelText("Endereço").find((el) => dialogo.contains(el))!;
    fireEvent.change(termo, { target: { value: "Jo" } });
    expect(screen.getByText(/pelo menos 3 letras/)).toBeTruthy();

    fireEvent.change(termo, { target: { value: "José" } });
    const item = await screen.findByRole("button", { name: /Rua José Pedro Correia Filho/ }, { timeout: 2000 });
    expect(pesquisa).toHaveBeenCalledWith("SC", "Palhoça", "José");
    expect(screen.getByText("88138-152")).toBeTruthy();

    fireEvent.click(item);
    expect(aoEscolher).toHaveBeenCalledWith(RUA);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
