// src/modules/ReferenceUnits.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReferenceUnits } from "./ReferenceUnits";
import type { ReferenceUnit } from "../lib/citizenApi";

const NO_ADDRESS = { street: null, number: null, complement: null, zip: null };
const ubs: ReferenceUnit = {
  id: "u1", name: "UBS Batel", kind: "ubs",
  address: { street: "Rua Padre Anchieta", number: "1500", complement: null, zip: "80730000" }
};
const upa: ReferenceUnit = { id: "u2", name: "UPA Matriz", kind: "upa", address: NO_ADDRESS };

describe("ReferenceUnits", () => {
  it.each([ [ "lista vazia", [] ], [ "null", null ], [ "undefined", undefined ] ])("%s: bloco ausente", (_label, units) => {
    const { container } = render(<ReferenceUnits units={units as ReferenceUnit[] | null | undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uma unidade: título no singular, nome, tipo e endereço", () => {
    render(<ReferenceUnits units={[ ubs ]} />);
    expect(screen.getByRole("heading", { name: "Sua unidade de referência" })).toBeInTheDocument();
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
    expect(screen.getByText("UBS")).toBeInTheDocument();
    expect(screen.getByText("Rua Padre Anchieta, 1500 · CEP 80730-000")).toBeInTheDocument();
    expect(screen.getByText(/Você pode procurar qualquer unidade de saúde/)).toBeInTheDocument();
  });

  it("duas unidades: título no plural e as duas; a sem endereço fica sem linha de endereço", () => {
    const { container } = render(<ReferenceUnits units={[ ubs, upa ]} />);
    expect(screen.getByRole("heading", { name: "Suas unidades de referência" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("UPA Matriz")).toBeInTheDocument();
    expect(screen.getByText("UPA")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|null|CEP\s*$/);
  });

  it("endereço parcial e tipo desconhecido: mostra só o que existe", () => {
    const { container } = render(<ReferenceUnits units={[
      { id: "u3", name: "Clínica da Família", kind: "clinica_nova",
        address: { street: null, number: "10", complement: null, zip: "80730000" } }
    ]} />);
    expect(screen.getByText("Clínica da Família")).toBeInTheDocument();
    expect(screen.getByText("CEP 80730-000")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|null|clinica_nova/);
  });
});
