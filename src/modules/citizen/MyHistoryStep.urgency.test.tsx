// Módulo 32a (contrato §10): atendimento de urgência em "Meu histórico", sem CID, cor, queixa nem médico.
// Fetch falso por URL, para a normalização de citizenApi.history() rodar de verdade.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MyHistoryStep } from "./MyHistoryStep";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-05T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const GUIDANCE = "Procure a sua UBS em até 7 dias.";
const URGENCY = { id: "urgency:e1", kind: "urgency", occurred_at: "2026-11-04T22:10:00-03:00", unit: { name: "UPA Boqueirão" },
  professional_name: "Dr. Paulo Mendes", title: "Atendimento de urgência — UPA Boqueirão",
  summary: "Alta, com orientação para procurar a sua UBS", status: "closed", return_guidance: GUIDANCE,
  color: "yellow", cid10: "I10", complaint: "dor de cabeça forte" };
const CONSULTATION = { id: "consultation:c1", kind: "consultation", occurred_at: "2026-11-04T23:00:00-03:00",
  unit: { name: "UPA Boqueirão" }, title: "Consulta" };

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

describe("MyHistoryStep — urgência (módulo 32a)", () => {
  it("Meu histórico: urgência com título, desfecho e orientação; sem cor, CID, queixa nem médico", async () => {
    stubCitizenApi([ CONSULTATION, URGENCY ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    const timeline = within(await screen.findByRole("region", { name: "Linha do tempo" }));
    const card = (await timeline.findByText("Atendimento de urgência — UPA Boqueirão")).closest("li") as HTMLElement;
    expect(within(card).getByText("Urgência")).toBeInTheDocument();
    expect(within(card).getByText("04/11/2026, 22:10")).toBeInTheDocument();
    expect(within(card).getByText("Alta, com orientação para procurar a sua UBS")).toBeInTheDocument();
    expect(within(card).getByText(`Orientação de retorno: ${GUIDANCE}`)).toBeInTheDocument();
    expect(within(card).getByText("UPA Boqueirão")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/yellow|amarel|I10|dor de cabeça|Dr\. Paulo Mendes|atendimento encerrado|Registro/);
  });

  it("evasão: só o desfecho, sem orientação", async () => {
    stubCitizenApi([ { ...URGENCY, summary: "Saiu antes do atendimento", return_guidance: null } ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    expect(await screen.findByText("Saiu antes do atendimento")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Orientação de retorno/);
  });

  it("orientação longa: inteira, no cartão", async () => {
    const long = `${"Volte à UBS Vila Hauer para medir a pressão e trazer os exames pedidos na UPA. ".repeat(4)}Se piorar, volte à UPA.`;
    stubCitizenApi([ { ...URGENCY, return_guidance: long } ]);
    render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);
    const line = await screen.findByText(`Orientação de retorno: ${long}`);
    expect(line.closest("li")).not.toBeNull();
  });
});
