import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogStep, EMPTY_CATALOG_MESSAGE } from "./CatalogStep";
import { ApiError, citizenApi, type Catalog } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const FULL: Catalog = {
  in_progress: null,
  suggested: [ { protocol_name: "saude-mental-aprofundada", title: "Saúde mental — aprofundamento",
    summary: "Mais perguntas sobre humor e sono.", suggestion_id: "s1", source_triage_id: "t0", source_title: "Saúde mental", suggested_on: "2026-10-02" } ],
  available: [
    { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Avaliação anual de quedas, memória e medicamentos." },
    { protocol_name: "triage-respiratoria", title: "Sintomas respiratórios", summary: null }
  ],
  recent: [ { protocol_name: "saude-mental", title: "Saúde mental", summary: null,
    last_completed_on: "2026-10-02", next_available_on: "2027-03-10" } ],
  reference_units: []
};

const EMPTY: Catalog = { in_progress: null, suggested: [], available: [], recent: [], reference_units: [] };

function setup(catalog: Catalog | Error, onStartResult: string | null = null) {
  const load = vi.spyOn(citizenApi, "catalog");
  if (catalog instanceof Error) load.mockRejectedValue(catalog); else load.mockResolvedValue(catalog);
  const props = {
    onStart: vi.fn<(name: string) => Promise<string | null>>().mockResolvedValue(onStartResult),
    onProfileRequired: vi.fn(), onProfile: vi.fn(), onHistory: vi.fn(), onBack: vi.fn()
  };
  render(<CatalogStep citizenId="p1" {...props} />);
  return { load, ...props };
}

const region = (name: string) => screen.findByRole("region", { name });
const item = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

describe("CatalogStep", () => {
  it("mostra as três seções na ordem do api, com a origem e as datas de calendário", async () => {
    const { load } = setup(FULL);
    const suggested = await region("Sugeridas para você");
    expect(load).toHaveBeenCalledWith("p1");
    expect(within(suggested).getByText("Saúde mental — aprofundamento")).toBeInTheDocument();
    expect(within(suggested).getByText("Sugerida pelo resultado da triagem Saúde mental de 02/10/2026")).toBeInTheDocument();

    const available = screen.getByRole("region", { name: "Disponíveis" });
    const titles = within(available).getAllByRole("listitem").map(li => li.querySelector("strong")?.textContent);
    expect(titles).toEqual([ "Saúde do idoso", "Sintomas respiratórios" ]);

    const recent = screen.getByRole("region", { name: "Feitas recentemente" });
    expect(within(recent).getByText("Feita em 02/10/2026")).toBeInTheDocument();
    expect(within(recent).getByText("Próxima a partir de 10/03/2027")).toBeInTheDocument();
    expect(within(recent).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Em andamento" })).not.toBeInTheDocument();
  });

  it("resumo ausente não vira texto", async () => {
    setup(FULL);
    await region("Disponíveis");
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });

  it("'Começar' numa disponível e numa sugerida chama onStart com o nome do protocolo", async () => {
    const { onStart } = setup(FULL);
    await region("Disponíveis");
    await userEvent.click(within(item("Saúde do idoso")).getByRole("button", { name: "Começar" }));
    expect(onStart).toHaveBeenLastCalledWith("saude-do-idoso");
    await userEvent.click(within(item("Saúde mental — aprofundamento")).getByRole("button", { name: "Começar" }));
    expect(onStart).toHaveBeenLastCalledWith("saude-mental-aprofundada");
  });

  it("'Em andamento' aparece primeiro, com 'Continuar'", async () => {
    const { onStart } = setup({ ...FULL,
      in_progress: { conversation_id: "c1", protocol_name: "triage-respiratoria", title: "Sintomas respiratórios" } });
    const inProgress = await region("Em andamento");
    await userEvent.click(within(inProgress).getByRole("button", { name: "Continuar" }));
    expect(onStart).toHaveBeenCalledWith("triage-respiratoria");
    const headings = screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent);
    expect(headings[0]).toBe("Em andamento");
  });

  it("toque duplo em 'Começar' chama uma vez só", async () => {
    const { onStart } = setup(FULL);
    onStart.mockReturnValue(new Promise<string | null>(() => {}));
    await region("Disponíveis");
    const btn = within(item("Saúde do idoso")).getByRole("button", { name: "Começar" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
  });

  it("recusa ao começar: mostra o aviso e relê o catálogo", async () => {
    const { load } = setup(FULL, "Esta triagem não está mais disponível para esta pessoa.");
    await region("Disponíveis");
    await userEvent.click(within(item("Saúde do idoso")).getByRole("button", { name: "Começar" }));
    expect(await screen.findByText("Esta triagem não está mais disponível para esta pessoa.")).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("aviso vindo do Flow aparece no topo", async () => {
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(FULL);
    render(<CatalogStep citizenId="p1" notice="Perfil atualizado." onStart={vi.fn()} onProfileRequired={vi.fn()}
      onProfile={vi.fn()} onHistory={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Perfil atualizado.");
  });

  it("catálogo vazio: mensagem neutra e a unidade de referência", async () => {
    setup({ ...EMPTY, reference_units: [ { id: "u1", name: "UBS Batel", kind: "ubs",
      address: { street: "Rua Padre Anchieta", number: "1500", complement: null, zip: "80730000" } } ] });
    expect(await screen.findByText(EMPTY_CATALOG_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sua unidade de referência" })).toBeInTheDocument();
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
  });

  it("catálogo vazio sem unidade (sem bairro ou api sem o campo): só a mensagem", async () => {
    setup(EMPTY);
    expect(await screen.findByText(EMPTY_CATALOG_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/unidade de referência|unidades de referência/)).not.toBeInTheDocument();
  });

  it("só 'Feitas recentemente' também é vazio para começar: mensagem e a lista das feitas", async () => {
    setup({ ...EMPTY, recent: FULL.recent });
    expect(await screen.findByText(EMPTY_CATALOG_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Feitas recentemente" })).toBeInTheDocument();
  });

  it("409 profile_required leva ao perfil", async () => {
    const { onProfileRequired } = setup(new ApiError(409, "profile_required"));
    await waitFor(() => expect(onProfileRequired).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("outro erro mostra a mensagem", async () => {
    setup(new ApiError(404, "not_found"));
    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeInTheDocument();
  });

  it("rodapé: Meu perfil, Minhas triagens e Voltar", async () => {
    const { onProfile, onHistory, onBack } = setup(FULL);
    await region("Disponíveis");
    await userEvent.click(screen.getByRole("button", { name: "Meu perfil" }));
    await userEvent.click(screen.getByRole("button", { name: "Minhas triagens" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onProfile).toHaveBeenCalled();
    expect(onHistory).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it("sem source_title: frase sem o título, sem 'undefined' nem 'null'", async () => {
    const cat: Catalog = { ...EMPTY, suggested: [ { ...FULL.suggested[0], source_title: null } ] };
    setup(cat);
    const suggested = await region("Sugeridas para você");
    expect(within(suggested).getByText("Sugerida pelo resultado de uma triagem de 02/10/2026")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("com um início pendente, os botões do rodapé ficam desabilitados", async () => {
    const { onStart } = setup(FULL);
    onStart.mockReturnValue(new Promise(() => {}));
    await region("Disponíveis");
    await userEvent.click(within(item("Saúde do idoso")).getByRole("button", { name: "Começar" }));
    for (const name of [ "Meu perfil", "Minhas triagens", "Voltar" ])
      expect(screen.getByRole("button", { name })).toBeDisabled();
  });
});
