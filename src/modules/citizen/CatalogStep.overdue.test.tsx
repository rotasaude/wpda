import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogStep } from "./CatalogStep";
import { citizenApi, type Catalog } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setSessionFeatures(null); });

const IDOSO = { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Avaliação anual de quedas, memória e medicamentos.",
  overdue: true, last_done_at: "2025-10-02" };
const RESP = { protocol_name: "triage-respiratoria", title: "Sintomas respiratórios", summary: null, overdue: false, last_done_at: null };
const catalog = (available: Catalog["available"]): Catalog =>
  ({ in_progress: null, suggested: [], available, recent: [], reference_units: [] });

function setup(c: Catalog) {
  vi.spyOn(citizenApi, "catalog").mockResolvedValue(c);
  const onStart = vi.fn<(name: string) => Promise<string | null>>().mockResolvedValue(null);
  render(<CatalogStep citizenId="p1" onStart={onStart} onProfileRequired={vi.fn()} onProfile={vi.fn()} onHistory={vi.fn()} onBack={vi.fn()} />);
  return { onStart };
}

describe("CatalogStep — triagem periódica vencida (módulo 23)", () => {
  it("vencida aparece em 'Está na hora de refazer', com a última vez, e começa pelo mesmo botão", async () => {
    const { onStart } = setup(catalog([ IDOSO, RESP ]));
    const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
    const item = within(overdue).getByText("Saúde do idoso").closest("li") as HTMLElement;
    expect(within(item).getByText("Feita pela última vez em 02/10/2025")).toBeInTheDocument();
    const available = screen.getByRole("region", { name: "Disponíveis" });
    expect(within(available).queryByText("Saúde do idoso")).not.toBeInTheDocument();
    expect(within(available).getByText("Sintomas respiratórios")).toBeInTheDocument();
    await userEvent.click(within(item).getByRole("button", { name: "Começar: Saúde do idoso" }));
    expect(onStart).toHaveBeenCalledWith("saude-do-idoso");
  });

  it("L9: sem care_lines na sessão, a vencida continua em 'Está na hora de refazer'", async () => {
    setSessionFeatures([]);
    setup(catalog([ IDOSO, RESP ]));
    const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
    expect(within(overdue).getByText("Saúde do idoso")).toBeInTheDocument();
  });

  it("sem overdue (api antigo): Disponíveis como hoje", async () => {
    setup(catalog([ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: null } ]));
    const available = await screen.findByRole("region", { name: "Disponíveis" });
    expect(within(available).getByText("Saúde do idoso")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Está na hora de refazer" })).not.toBeInTheDocument();
  });

  it("vencida sem data: sem a linha da data, nada de undefined", async () => {
    setup(catalog([ { ...IDOSO, last_done_at: null } ]));
    const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
    expect(within(overdue).queryByText(/Feita pela última vez/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
    expect(screen.queryByRole("region", { name: "Disponíveis" })).not.toBeInTheDocument();
  });

  it("a seção vencida vem antes das sugeridas", async () => {
    vi.spyOn(citizenApi, "catalog").mockResolvedValue({
      in_progress: null, available: [ IDOSO ], recent: [], reference_units: [],
      suggested: [ { suggestion_id: "s1", protocol_name: "triage-respiratoria", title: "Sintomas respiratórios", summary: null,
        source_title: null, suggested_on: "2026-10-01" } as unknown as Catalog["suggested"][number] ]
    });
    render(<CatalogStep citizenId="p1" onStart={vi.fn()} onProfileRequired={vi.fn()} onProfile={vi.fn()} onHistory={vi.fn()} onBack={vi.fn()} />);
    const due = await screen.findByRole("region", { name: "Está na hora de refazer" });
    const suggested = screen.getByRole("region", { name: "Sugeridas para você" });
    expect(due.compareDocumentPosition(suggested) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("sugeridas (M1)", () => {
    const sug = (protocol_name: string, title: string, extra: object = {}) =>
      ({ suggestion_id: `s-${protocol_name}`, protocol_name, title, summary: null, source_title: null,
        suggested_on: "2026-10-01", ...extra }) as unknown as Catalog["suggested"][number];
    const withSuggested = (suggested: Catalog["suggested"], available: Catalog["available"] = []): Catalog =>
      ({ in_progress: null, suggested, available, recent: [], reference_units: [] });

    it("(a) sugerida vencida aparece só em 'Está na hora de refazer', com a última vez e o Começar", async () => {
      const { onStart } = setup(withSuggested([ sug("saude-do-idoso", "Saúde do idoso", { overdue: true, last_done_at: "2025-10-02" }) ]));
      const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
      expect(within(overdue).getByText("Saúde do idoso")).toBeInTheDocument();
      expect(within(overdue).getByText("Feita pela última vez em 02/10/2025")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Sugeridas para você" })).not.toBeInTheDocument();
      expect(screen.getAllByText("Saúde do idoso")).toHaveLength(1);
      await userEvent.click(within(overdue).getByRole("button", { name: "Começar: Saúde do idoso" }));
      expect(onStart).toHaveBeenCalledWith("saude-do-idoso");
      // nothingToStart segue falso: sem a frase de catálogo vazio.
      expect(screen.queryByText(/Não há triagens disponíveis/)).not.toBeInTheDocument();
    });

    it("(b) sugerida não vencida aparece só em 'Sugeridas para você'", async () => {
      setup(withSuggested([ sug("triage-respiratoria", "Sintomas respiratórios", { overdue: false, last_done_at: null }) ]));
      const suggested = await screen.findByRole("region", { name: "Sugeridas para você" });
      expect(within(suggested).getByText("Sintomas respiratórios")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Está na hora de refazer" })).not.toBeInTheDocument();
    });

    it("(c) disponível vencida continua em refazer; mistura sem duplicata", async () => {
      setup(withSuggested(
        [ sug("saude-do-idoso", "Saúde do idoso", { overdue: true, last_done_at: "2025-10-02" }),
          sug("triage-respiratoria", "Sintomas respiratórios", { overdue: false }) ],
        [ { ...IDOSO, protocol_name: "saude-da-mulher", title: "Saúde da mulher", last_done_at: "2025-09-01" } ]));
      const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
      expect(within(overdue).getAllByRole("listitem").map(li => li.querySelector("strong")?.textContent))
        .toEqual([ "Saúde da mulher", "Saúde do idoso" ]);
      expect(within(screen.getByRole("region", { name: "Sugeridas para você" })).getAllByRole("listitem")).toHaveLength(1);
      expect(screen.queryByRole("region", { name: "Disponíveis" })).not.toBeInTheDocument();
    });

    it("mesmo protocolo nas duas listas (defesa): aparece uma vez só", async () => {
      setup(withSuggested([ sug("saude-do-idoso", "Saúde do idoso", { overdue: true, last_done_at: "2025-10-02" }) ], [ IDOSO ]));
      const overdue = await screen.findByRole("region", { name: "Está na hora de refazer" });
      expect(within(overdue).getAllByRole("listitem")).toHaveLength(1);
      expect(screen.getAllByText("Saúde do idoso")).toHaveLength(1);
    });

    it("(d) refazer vem antes das sugeridas, mesmo quando a vencida era sugerida", async () => {
      setup(withSuggested([ sug("triage-respiratoria", "Sintomas respiratórios"),
        sug("saude-do-idoso", "Saúde do idoso", { overdue: true, last_done_at: "2025-10-02" }) ]));
      const due = await screen.findByRole("region", { name: "Está na hora de refazer" });
      const suggested = screen.getByRole("region", { name: "Sugeridas para você" });
      expect(due.compareDocumentPosition(suggested) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
