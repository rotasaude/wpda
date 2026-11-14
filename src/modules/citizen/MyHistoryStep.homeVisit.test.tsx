// Módulo 24b (spec decisão 3A; contrato §12): a visita do agente de saúde em "Meu histórico". Só "Visita", o dia e
// "Visita do agente de saúde". Fetch falso por URL, para a normalização de citizenApi.history() rodar de verdade.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MyHistoryStep } from "./MyHistoryStep";
import { citizenApi } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// A visão do profissional (Q58), como a de um api com defeito: o que for do profissional não pode aparecer.
const VISIT = { id: "home_visit:v1", kind: "home_visit", occurred_at: "2026-11-10T09:40:00-03:00",
  unit: { name: "UBS Vila Verde" }, professional_name: "Maria Souza", title: "Visita domiciliar",
  summary: "Visita realizada · Acompanhamento de gestante · PA 120/80 mmHg", status: null, return_guidance: "Volte em 30 dias",
  reasons: [ 5 ], measurements: { systolic: 120, diastolic: 80 }, note: "cachorro bravo no portão" };
const CONSULTATION = { id: "consultation:c1", kind: "consultation", occurred_at: "2026-11-09T15:00:00-03:00",
  unit: { name: "UBS Vila Verde" }, title: "Consulta" };

function stubCitizenApi(timeline: unknown[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/citizen/health_summary")) return json({ problems: [], medications: [], exam_requests: [], vitals: {} });
    if (url.includes("kinds%5B%5D=")) return json({ verified: true, partial: false, entries: [], next_before: null });
    return json({ verified: true, partial: false, entries: timeline, next_before: null });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MyHistoryStep — visita do agente de saúde (módulo 24b)", () => {
  it("Meu histórico: visita com o rótulo, o dia e o título; nada do profissional", async () => {
    stubCitizenApi([ VISIT, CONSULTATION ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    const timeline = within(await screen.findByRole("region", { name: "Linha do tempo" }));
    const card = (await timeline.findByText("Visita do agente de saúde")).closest("li") as HTMLElement;
    expect(within(card).getByText("Visita")).toBeInTheDocument();
    expect(within(card).getByText("10/11/2026")).toBeInTheDocument();
    expect(card.textContent).toBe("Visita10/11/2026Visita do agente de saúde");
    expect(document.body.textContent).not.toMatch(/Maria Souza|Visita domiciliar|gestante|120\/80|cachorro|Volte em 30|09:40|Registro/);
  });

  it("recusa, ausência e retirada que vazem: nenhum cartão de visita", async () => {
    stubCitizenApi([ { ...VISIT, id: "home_visit:r", status: "recorded", summary: "Visita recusada" },
      { ...VISIT, id: "home_visit:a", status: "recorded", summary: "Ausente" },
      { ...VISIT, id: "home_visit:w", status: "withdrawn" }, CONSULTATION ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    expect((await screen.findAllByText("Consulta")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Visita do agente de saúde")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Recusad|Ausente|retirad/i);
  });

  it("a tela não desenha resumo nem documento da visita, mesmo que a camada de dados os entregue", async () => {
    const visit = {
      id: "home_visit:x", kind: "home_visit", occurred_at: "2026-11-10T12:00:00-03:00", unit: null, professional_name: null,
        title: "Visita do agente de saúde", summary: "X-RESUMO", status: null,
        document: { id: "d1", short_code: "C1", verification_url: "https://x", downloadable: true } };
    vi.spyOn(citizenApi, "history").mockImplementation(async (_id, opts) => (
      { verified: true, partial: false, next_before: null, entries: opts?.kinds?.length ? [] : [ visit ] }) as never);
    vi.spyOn(citizenApi, "healthSummary").mockResolvedValue({ problems: [], medications: [], exam_requests: [], vitals: {} } as never);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    expect(await screen.findByText("Visita do agente de saúde")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/X-RESUMO|Código de conferência|Baixar PDF/);
  });
});
