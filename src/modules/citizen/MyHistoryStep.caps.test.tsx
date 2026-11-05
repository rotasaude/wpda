// Módulo 31 (ADR 0049, decisão 4): nada do CAPS no "Meu histórico", nem na linha do tempo nem nos documentos.
// Fetch falso por URL, para a normalização de citizenApi.history() rodar de verdade.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MyHistoryStep } from "./MyHistoryStep";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-04T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const CAPS_ACTION = { id: "psychosocial_action:a1", kind: "psychosocial_action", occurred_at: "2026-11-03T10:00:00-03:00",
  unit: { name: "CAPS AD Centro" }, professional_name: "Psic. Ana Lima", title: "Atendimento individual — F19.2", summary: "Sertralina 50 mg" };
const CAPS_MARKER = { id: "psychosocial_link:e1", kind: "psychosocial_link", occurred_at: "2026-10-01T00:00:00-03:00",
  unit: { name: "CAPS AD Centro" }, title: "Acompanhamento no CAPS AD Centro" };
const CONSULTATION = { id: "consultation:c1", kind: "consultation", occurred_at: "2026-10-20T09:00:00-03:00",
  unit: { name: "UBS Centro" }, title: "Consulta com Dra. Helena Prado" };
const DOCUMENT = { id: "clinical_document:doc2", kind: "clinical_document", occurred_at: "2026-09-10T14:40:00-03:00",
  unit: { name: "UBS Centro" }, professional_name: "Dra. Helena Prado", title: "Receita", status: "issued",
  document: { id: "doc2", short_code: "P3H8T-2LQ6R", verification_url: "https://curitiba.rotasaude.app/v/tok2", downloadable: true } };

function stubCitizenApi(timeline: unknown[], documents: unknown[], next_before: string | null = null) {
  const fetchMock = vi.fn(async (url: string) => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/citizen/health_summary")) return json({ problems: [], medications: [], exam_requests: [], vitals: {} });
    if (url.includes("kinds%5B%5D=")) return json({ verified: true, partial: false, entries: documents, next_before: null });
    return json({ verified: true, partial: false, entries: timeline, next_before });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MyHistoryStep — nada do CAPS (módulo 31)", () => {
  it("Meu histórico: nada do CAPS na linha do tempo nem nos documentos", async () => {
    stubCitizenApi([ CAPS_ACTION, CONSULTATION, CAPS_MARKER ], [ { ...CAPS_ACTION, kind: "psychosocial_document" }, DOCUMENT ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    const timeline = within(await screen.findByRole("region", { name: "Linha do tempo" }));
    expect(await timeline.findByText("Consulta com Dra. Helena Prado")).toBeInTheDocument();
    const docs = within(await screen.findByRole("region", { name: "Documentos" }));
    expect(await docs.findByText("Receita")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/CAPS|psicossocial|psychosocial|F19|Sertralina|Psic\. Ana Lima|Registro/);
  });

  it("página só com entradas do CAPS: vazio e 'Carregar mais'", async () => {
    stubCitizenApi([ CAPS_ACTION, CAPS_MARKER ], [], "2026-10-01T00:00:00-03:00");
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    expect(await screen.findByText("Nenhum registro ainda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/CAPS|Registro/);
  });
});
