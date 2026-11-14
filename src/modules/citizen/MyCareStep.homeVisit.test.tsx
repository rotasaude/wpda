// Módulo 24b (spec decisões 3A e 23; contrato §12, Q25): com home_visits na cidade, a prática de visita entra em
// "Meu acompanhamento" como item rastreado, com o citizen_label do catálogo e `by_team: true`. O api faz a conta;
// aqui só se desenha o rótulo e a situação, com as frases do agente. Fetch falso, para o normalizeCare rodar de verdade.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MyCareStep } from "./MyCareStep";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const LABEL = "Visitas do agente de saúde";
// Campos fora do contrato §7 do 23, como os de um api com defeito: nunca aparecem.
const EXTRA = { source: "acs_visit", practice_key: "c5_d", min_gap_days: 30, last_visit_on: "2026-11-10",
  professional: { name: "Maria Souza" }, reasons: [ 13 ] };

function stubCare(status: string, due_on: string | null, extra: Record<string, unknown> = { by_team: true }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (!url.startsWith("/citizen/care?")) throw new Error(`rota inesperada: ${url}`);
    return new Response(JSON.stringify({ overdue_triages: [], lines: [ { name: "Pessoa com hipertensão", items: [
      { label: "medir a pressão", status: "ok", due_on: "2027-01-06", by_team: false },
      { label: LABEL, status, due_on, ...EXTRA, ...extra }
    ] } ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderCare() {
  render(<MyCareStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onStartCatalog={vi.fn()} />);
}

describe("MyCareStep — prática de visita (módulo 24b)", () => {
  it("em dia: o rótulo e a situação; nada além", async () => {
    stubCare("ok", "2026-12-10");
    renderCare();
    const item = within(await screen.findByRole("listitem", { name: LABEL }));
    expect(item.getByText("Em dia")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/acs_visit|c5_d|min_gap|Maria Souza|2026-11-10|10\/11\/2026/);
  });

  it("perto do prazo: o agente de saúde deve passar até o dia; o outro item segue Em dia", async () => {
    stubCare("due_soon", "2026-12-10");
    renderCare();
    expect(within(await screen.findByRole("listitem", { name: LABEL })).getByText("O agente de saúde deve passar até 10/12/2026")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Medir a pressão" })).getByText("Em dia")).toBeInTheDocument();
  });

  it("atrasada, sem data: manda falar com a unidade de saúde", async () => {
    stubCare("overdue", null);
    renderCare();
    expect(within(await screen.findByRole("listitem", { name: LABEL }))
      .getByText("A visita está atrasada — fale com a sua unidade de saúde")).toBeInTheDocument();
  });

  it("item sem by_team atrasado: a frase de sempre", async () => {
    stubCare("overdue", "2026-10-01", {});
    renderCare();
    expect(within(await screen.findByRole("listitem", { name: LABEL }))
      .getByText("Está na hora — procure a sua unidade de saúde")).toBeInTheDocument();
  });
});
