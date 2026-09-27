import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
