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

  it("produção não mostra a faixa de ambiente de teste", () => {
    stubDevice({ width: 1920, height: 1080, coarse: false });
    render(<App />);
    expect(screen.queryByRole("note", { name: /ambiente de teste/ })).toBeNull();
  });

  it("relatório (?token=) abre em qualquer tela", () => {
    stubDevice({ width: 1920, height: 1080, coarse: false });
    window.history.replaceState(null, "", "/wpda/?token=abc");
    render(<App />);
    expect(screen.getByText("RELATORIO")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Abra no celular" })).toBeNull();
  });
});

// Dev e staging liberam o desktop, sempre com a faixa visível (rotasaude/wpda#2).
describe("liberação do desktop fora de produção", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.__WPDA_RUNTIME__;
  });

  it.each([
    [ "dev server", () => vi.stubEnv("MODE", "development") ],
    [ "staging (runtime-config)", () => { window.__WPDA_RUNTIME__ = { allowDesktop: true }; } ]
  ])("%s: desktop vê o fluxo e a faixa", (_name, enable) => {
    enable();
    stubDevice({ width: 1920, height: 1080, coarse: false });
    render(<App />);
    expect(screen.getByText("FLUXO")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Abra no celular" })).toBeNull();
    expect(screen.getByRole("note", { name: /ambiente de teste/ })).toHaveTextContent("Modo desktop — ambiente de teste");
  });

  it("celular também vê a faixa: o ambiente fica visível em qualquer tela", () => {
    vi.stubEnv("MODE", "development");
    render(<App />);
    expect(screen.getByText("FLUXO")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: /ambiente de teste/ })).toBeInTheDocument();
  });
});
