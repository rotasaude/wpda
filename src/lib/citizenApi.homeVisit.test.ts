// Módulo 24b (contrato §12; W1, W5): a visita do agente de saúde no "Meu histórico". Só a realizada e não
// retirada, com a data e o título fixo. Nada da visão do profissional passa da borda.
import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, HOME_VISIT_KIND, HOME_VISIT_TITLE } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mockJson(body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const page = (entries: unknown[]) => ({ verified: true, partial: false, entries, next_before: null });

// Forma real do api: meio-dia local (home_visit_source.rb; json.rb).
const VISIT = { id: "home_visit:v1", kind: "home_visit", occurred_at: "2026-11-10T12:00:00-03:00", unit: null,
  professional_name: null, title: "Visita do agente de saúde", summary: null, status: null, document: null };
const TRIAGE = { id: "triage:t1", kind: "triage", occurred_at: "2026-11-09T20:15:00-03:00", title: "Triagem respiratória",
  professional_name: "Enf. Carla", status: "completed" };

describe("citizenApi.history — visita do agente de saúde (módulo 24b)", () => {
  it("constantes do contrato", () => {
    expect(HOME_VISIT_KIND).toBe("home_visit");
    expect(HOME_VISIT_TITLE).toBe("Visita do agente de saúde");
  });

  it("visita: só os campos do contrato, com o título fixo", async () => {
    mockJson(page([ { ...VISIT, title: "Visita domiciliar",
      summary: "Visita realizada · Visita periódica, Gestante · PA 130/80 mmHg · peso 72 kg",
      unit: { name: "UBS Centro" }, professional_name: "Maria Souza", status_label: "realizada", return_guidance: "Volte em 30 dias",
      document: { id: "d1", short_code: "X1" }, reasons: [ 5 ], measurements: { systolic: 130, diastolic: 80 },
      note: "cachorro bravo no portão", micro_area: { code: "03" }, household: { address_short: "Rua A, 10" } } ]));
    const h = await citizenApi.history("p1");
    expect(h.entries).toEqual([ { id: "home_visit:v1", kind: "home_visit", occurred_at: "2026-11-10T12:00:00-03:00", unit: null,
      professional_name: null, title: "Visita do agente de saúde", summary: null, status: null, document: null } ]);
    expect(JSON.stringify(h)).not.toMatch(/Maria|UBS Centro|gestante|Gestante|130|mmHg|cachorro|realizada|Volte|Rua A|reasons|measurements|note|micro_area|Visita domiciliar/);
  });

  it("visita com situação (visão do profissional) ou sem data: some", async () => {
    mockJson(page([
      { ...VISIT, id: "home_visit:withdrawn", status: "withdrawn", title: "Visita domiciliar" },
      { ...VISIT, id: "home_visit:recorded", status: "recorded", title: "Visita domiciliar",
        summary: "Visita realizada · Visita periódica, Gestante · PA 130/80 mmHg · peso 72 kg" },
      { ...VISIT, id: "home_visit:no-date", occurred_at: undefined },
      { ...VISIT, id: "home_visit:empty-date", occurred_at: "" },
      { ...VISIT, id: "home_visit:plain" }
    ]));
    const h = await citizenApi.history("p1");
    expect(h.entries.map((x) => x.id)).toEqual([ "home_visit:plain" ]);
  });

  it("os outros kinds não mudam", async () => {
    mockJson(page([ VISIT, TRIAGE, { id: "psychosocial:x", kind: "psychosocial", occurred_at: "2026-11-08T10:00:00-03:00", title: "CAPS" } ]));
    const h = await citizenApi.history("p1");
    expect(h.entries.map((x) => x.id)).toEqual([ "home_visit:v1", "triage:t1" ]);
    expect(h.entries[1]).toEqual({ id: "triage:t1", kind: "triage", occurred_at: "2026-11-09T20:15:00-03:00", unit: null,
      professional_name: "Enf. Carla", title: "Triagem respiratória", summary: null, status: "completed", document: null });
  });

  it("a linha do tempo não pede kinds: a visita chega na lista de sempre (W1)", async () => {
    const fn = mockJson(page([ VISIT ]));
    await citizenApi.history("p1");
    const url = new URL(String(fn.mock.calls[0][0]), "http://curitiba.localhost");
    expect(url.searchParams.getAll("kinds[]")).toEqual([]);
    expect(url.search).not.toMatch(/home_visit/);
  });
});
