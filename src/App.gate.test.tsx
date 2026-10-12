import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { stubDevice } from "./test/setup";

vi.mock("./modules/citizen/Flow", () => ({ Flow: () => <main>FLUXO</main> }));
vi.mock("./modules/Report", () => ({ Report: () => <main>RELATORIO</main> }));
import { App } from "./App";

afterEach(() => window.history.replaceState(null, "", "/wpda/"));

describe("bloqueio fora do celular", () => {
  it("celular vê o fluxo", () => {
    render(<App />);
    expect(screen.getByText("FLUXO")).toBeInTheDocument();
  });

  it("desktop vê 'Abra no celular' com endereço e 192, e não o fluxo", () => {
    stubDevice({ width: 1920, height: 1080, coarse: false });
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Abra no celular" })).toBeInTheDocument();
    expect(screen.getByText(/Este serviço foi feito para ser usado no celular/)).toBeInTheDocument();
    expect(screen.getByText(window.location.origin + window.location.pathname)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Emergência? Ligar 192" })).toBeInTheDocument();
    expect(screen.queryByText("FLUXO")).toBeNull();
  });

  it("relatório (?token=) abre em qualquer tela", () => {
    stubDevice({ width: 1920, height: 1080, coarse: false });
    window.history.replaceState(null, "", "/wpda/?token=abc");
    render(<App />);
    expect(screen.getByText("RELATORIO")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Abra no celular" })).toBeNull();
  });
});
