import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultStep } from "./ResultStep";
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

    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} />);

    expect(screen.getByText("Preparando seu resultado…")).toBeInTheDocument();
    expect(await screen.findByText("Procure atendimento hoje", undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(triage).toHaveBeenCalledWith("t1");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/r/abc");
  });

  it("oferece nova triagem e o histórico", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue(summary(null));
    const onAgain = vi.fn();
    const onHistory = vi.fn();

    render(<ResultStep triageId="t1" onAgain={onAgain} onHistory={onHistory} />);
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
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Sua unidade de referência" })).toBeInTheDocument();
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
  });

  it("com o relatório pronto, continua mostrando as unidades da triagem (duas), uma vez só", async () => {
    vi.spyOn(citizenApi, "triage").mockResolvedValue({
      ...summary("http://curitiba.localhost/wpda/?token=abc"), reference_units: units
    });
    stubReport();
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} />);

    expect(await screen.findByText("Procure atendimento hoje")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Suas unidades de referência" })).toHaveLength(1);
    expect(screen.getByText("UBS Batel")).toBeInTheDocument();
    expect(screen.getByText("UPA Matriz")).toBeInTheDocument();
  });

  it("triagem sem unidade de referência: bloco ausente", async () => {
    const triage = vi.spyOn(citizenApi, "triage").mockResolvedValue({ ...summary(null), reference_units: [] });
    render(<ResultStep triageId="t1" onAgain={vi.fn()} onHistory={vi.fn()} />);
    expect(screen.getByText("Preparando seu resultado…")).toBeInTheDocument();
    await waitFor(() => expect(triage).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/unidade de referência|unidades de referência/)).not.toBeInTheDocument();
  });
});
