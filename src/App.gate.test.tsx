import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubDevice } from "./test/setup";
import { ApiError, citizenApi } from "./lib/citizenApi";

vi.mock("./modules/citizen/Flow", () => ({ Flow: () => <main>FLUXO</main> }));
vi.mock("./modules/Report", () => ({ Report: () => <main>RELATORIO</main> }));
import { App } from "./App";

// A tela "Abra no celular" pede o public_config da Ouvidoria (U2); por padrão, desligada (403, Q1).
beforeEach(() => { vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockRejectedValue(new ApiError(403, "feature_disabled")); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/wpda/"); });

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

// U2: a denúncia anônima abre também no desktop de produção, sem sessão; o resto segue só no celular.
describe("denúncia anônima fora do celular (U2)", () => {
  const CONFIG = { anonymous_web: true, units: [ { id: "u1", name: "UBS Centro" } ] };

  it("desktop de produção com anonymous_web: 'Abra no celular' e 'Denúncia anônima', que abre o formulário", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    stubDevice({ width: 1920, height: 1080, coarse: false });
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Abra no celular" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Denúncia anônima" }));
    expect(screen.queryByRole("button", { name: "Fazer uma manifestação" })).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "O que você quer denunciar?" })).toBeInTheDocument();
    expect(screen.queryByText("FLUXO")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Abra no celular" })).toBeInTheDocument();
  });

  it.each([
    [ "anonymous_web desligado", () => vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue({ ...CONFIG, anonymous_web: false }) ],
    [ "public_config 403", () => vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockRejectedValue(new ApiError(403, "feature_disabled")) ]
  ])("desktop de produção com %s: só 'Abra no celular'", async (_name, arrange) => {
    const spy = arrange();
    stubDevice({ width: 1920, height: 1080, coarse: false });
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Abra no celular" })).toBeInTheDocument();
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Ouvidoria" })).toBeNull();
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
