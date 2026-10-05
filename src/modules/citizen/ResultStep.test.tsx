import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultStep } from "./ResultStep";
import { LATER_NOTE } from "./AlsoRecommended";
import { citizenApi, type TriageSummary } from "../../lib/citizenApi";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function summary(report_url: string | null): TriageSummary {
  return {
    id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-27T12:00:00Z",
    completed_at: "2026-09-27T12:05:00Z", report_url, consent_active: true, origin_phone_masked: null,
    attendance: null, check_in_available: false
  };
}

function stubReport() {
  const fn = vi.fn(async () => new Response(JSON.stringify({
    tier: "alta", priority: "1",
    recommendation: { title: "Procure atendimento hoje", body: "Vá à UPA ainda hoje." },
    completed_at: "2026-09-27T12:05:00Z", expires_at: "2026-10-27T12:05:00Z"
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

// F-03.17: o resultado da triagem aparece no wpda assim que o relatório existe.
describe("ResultStep", () => {
  it("espera o link do relatório e mostra tier e recomendação do token", async () => {
    const triage = vi.spyOn(citizenApi, "triage")
      .mockResolvedValueOnce(summary(null))
      .mockResolvedValue(summary("http://curitiba.localhost/wpda/?token=abc"));
    const fetchMock = stubReport();

    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);

    expect(screen.getByText("Preparando seu resultado…")).toBeInTheDocument();
    expect(await screen.findByText("Procure atendimento hoje", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(triage).toHaveBeenCalledWith("t1");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/r/abc");
  });

  it("oferece nova triagem e o histórico", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue(summary(null));
    const onAgain = vi.fn();
    const onHistory = vi.fn();

    render(<ResultStep triageId="t1" onAgain={onAgain} onHistory={onHistory} onStartSuggestion={vi.fn()} />);
    await userEvent.click(screen.getByText("Fazer outra triagem"));
    await userEvent.click(screen.getByText("Minhas triagens"));

    expect(onAgain).toHaveBeenCalled();
    expect(onHistory).toHaveBeenCalled();
  });
});

describe("ResultStep — unidade de referência", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date("2026-09-28T10:00:00-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  const units = [
    { id: "u1", name: "UBS Batel", kind: "ubs",
      address: { street: "Rua Padre Anchieta", number: "1500", complement: null, zip: "80730000" } },
    { id: "u2", name: "UPA Matriz", kind: "upa", address: { street: null, number: null, complement: null, zip: null } }
  ];

  it("enquanto o relatório não fica pronto, mostra a unidade vinda da triagem", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), reference_units: [ units[0] ] });
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Sua unidade de referência" })).toBeInTheDocument();
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
  });

  it("com o relatório pronto, continua mostrando as unidades da triagem (duas), uma vez só", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({
      ...summary("http://curitiba.localhost/wpda/?token=abc"), reference_units: units
    });
    stubReport();
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);

    expect(await screen.findByText("Procure atendimento hoje")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Suas unidades de referência" })).toHaveLength(1);
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
    expect(screen.getByText("UPA Matriz")).toBeInTheDocument();
  });

  it("com o relatório pronto, unidades e botões ficam dentro do cartão do relatório", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({
      ...summary("http://curitiba.localhost/wpda/?token=abc"), reference_units: units
    });
    stubReport();
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);

    const card = (await screen.findByText("Procure atendimento hoje")).closest("article")!;
    expect(card).not.toBeNull();
    expect(within(card).getByRole("heading", { name: "Suas unidades de referência" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Fazer outra triagem" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Minhas triagens" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Fazer outra triagem" })).toHaveLength(1);
  });

  it("triagem sem unidade de referência: bloco ausente", async () => {
    const triage = vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), reference_units: [] });
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);
    expect(screen.getByText("Preparando seu resultado…")).toBeInTheDocument();
    await waitFor(() => expect(triage).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/unidade de referência|unidades de referência/)).not.toBeInTheDocument();
  });
});

describe("ResultStep — Recomendamos também (módulo 15)", () => {
  const suggestions = [
    { suggestion_id: "s1", protocol_name: "saude-mental-aprofundada", title: "Saúde mental — aprofundamento",
      summary: "Mais perguntas sobre humor e sono." },
    { suggestion_id: "s2", protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: null }
  ];

  it("mostra as sugestões enquanto o relatório é preparado; 'Fazer agora' chama com o nome do protocolo", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), suggestions });
    const onStartSuggestion = vi.fn<(name: string) => Promise<string | null>>().mockResolvedValue(null);
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={onStartSuggestion} />);

    const block = (await screen.findByRole("heading", { name: "Recomendamos também" })).closest("section")!;
    expect(within(block).getByText("Mais perguntas sobre humor e sono.")).toBeInTheDocument();
    expect(within(block).queryByText(/null|undefined/)).not.toBeInTheDocument();
    const item = within(block).getByText("Saúde mental — aprofundamento").closest("li")!;
    await userEvent.click(within(item).getByRole("button", { name: "Fazer agora" }));
    expect(onStartSuggestion).toHaveBeenCalledWith("saude-mental-aprofundada");
  });

  it("lista vazia (resultado urgente ou nada sugerido): bloco ausente", async () => {
    const triage = vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), suggestions: [] });
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);
    await waitFor(() => expect(triage).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Recomendamos também")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fazer agora" })).not.toBeInTheDocument();
  });

  it("api anterior sem o campo: bloco ausente", async () => {
    const triage = vi.spyOn(citizenApi, "triage").mockResolvedValue(summary(null));
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);
    await waitFor(() => expect(triage).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("Recomendamos também")).not.toBeInTheDocument();
  });

  it("'Depois' esconde a sugestão; sem nenhuma, fica só a nota de onde encontrá-las", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), suggestions: [ suggestions[0] ] });
    const onStartSuggestion = vi.fn();
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={onStartSuggestion} />);
    await userEvent.click(await screen.findByRole("button", { name: "Depois" }));
    expect(screen.queryByRole("heading", { name: "Recomendamos também" })).not.toBeInTheDocument();
    expect(screen.getByText(LATER_NOTE)).toBeInTheDocument();
    expect(onStartSuggestion).not.toHaveBeenCalled();
  });

  it("'Depois' continua valendo quando o relatório fica pronto", async () => {
    vi.spyOn(citizenApi, "triage")
      .mockResolvedValueOnce({ ...summary(null), suggestions: [ suggestions[0] ] })
      .mockResolvedValue({ ...summary("http://curitiba.localhost/wpda/?token=abc"), suggestions: [ suggestions[0] ] });
    stubReport();
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Depois" }));
    expect(await screen.findByText("Procure atendimento hoje", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fazer agora" })).not.toBeInTheDocument();
    expect(screen.getByText(LATER_NOTE)).toBeInTheDocument();
  });

  it("recusa ao começar aparece no bloco", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), suggestions: [ suggestions[0] ] });
    const onStartSuggestion = vi.fn().mockResolvedValue("Esta triagem não está mais disponível para esta pessoa.");
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={onStartSuggestion} />);
    await userEvent.click(await screen.findByRole("button", { name: "Fazer agora" }));
    expect(await screen.findByText("Esta triagem não está mais disponível para esta pessoa.")).toBeInTheDocument();
  });

  it("toque duplo em 'Fazer agora' chama uma vez só", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), suggestions: [ suggestions[0] ] });
    const onStartSuggestion = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} onStartSuggestion={onStartSuggestion} />);
    const btn = await screen.findByRole("button", { name: "Fazer agora" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onStartSuggestion).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
  });
});
