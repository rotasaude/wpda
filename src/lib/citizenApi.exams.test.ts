import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError, EXAMS_PAGE_SIZE } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mockJson(status: number, body: unknown) {
  const fn = vi.fn(async (_input?: unknown, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const urlOf = (fn: { mock: { calls: unknown[][] } }, i = 0) => new URL(String(fn.mock.calls[i][0]), "http://curitiba.localhost");

describe("citizenApi — Meus exames (módulo 21a)", () => {
  it("exams: citizen_id, limit 20 e o cursor como veio; nada pessoal na URL", async () => {
    const fn = mockJson(200, { verified: true, exams: [], next_before: null });
    await citizenApi.exams("p1");
    expect(urlOf(fn).pathname).toBe("/citizen/exams");
    expect([ ...urlOf(fn).searchParams.entries() ]).toEqual([ [ "citizen_id", "p1" ], [ "limit", String(EXAMS_PAGE_SIZE) ] ]);
    expect((fn.mock.calls[0][1] as RequestInit).method).toBe("GET");

    await citizenApi.exams("p 1", { before: "2026-10-01T09:00:00-03:00|ex9" });
    const url = urlOf(fn, 1);
    expect(url.searchParams.get("citizen_id")).toBe("p 1");
    expect(url.searchParams.get("before")).toBe("2026-10-01T09:00:00-03:00|ex9");
    expect(String(fn.mock.calls[1][0])).not.toMatch(/cpf|phone|\d{11}/i);
  });

  it("exams: normaliza o que faltar (api mais novo ou incompleto) e ignora campo a mais", async () => {
    mockJson(200, { exams: [
      { id: "ex1", label: "Hemograma completo", status_label: "Pedido", requested_at: "2026-10-01T09:00:00-03:00",
        critical: true, denial_reason: "fora do protocolo" },
      { id: "ex2", label: "Hemoglobina glicada", status_label: "Resultado disponível", requested_at: "2026-10-01T09:00:00-03:00",
        scheduled_at: "2026-10-05T07:30:00-03:00", result: { available: true } }
    ] });
    const r = await citizenApi.exams("p1");
    expect(r.verified).toBe(false);
    expect(r.next_before).toBeNull();
    expect(r.exams[0]).toEqual({
      id: "ex1", label: "Hemograma completo", status_label: "Pedido", requested_at: "2026-10-01T09:00:00-03:00",
      scheduled_at: null, scheduled_place: null, result: null
    });
    expect(r.exams[1].result).toEqual({ available: true, pickup_at_unit: false, released_on: null, pdf_available: false });
    expect(r.exams[1].scheduled_place).toBeNull();
  });

  it("exams: 403 feature_disabled e 404 not_found viram ApiError com o código", async () => {
    mockJson(403, { error: "feature_disabled", feature: "exam_tracking" });
    await expect(citizenApi.exams("p1")).rejects.toEqual(new ApiError(403, "feature_disabled"));
    mockJson(404, { error: "not_found" });
    await expect(citizenApi.exams("p9")).rejects.toEqual(new ApiError(404, "not_found"));
  });

  it("examPdf: blob, recusa com código e 401", async () => {
    const pdf = new Blob([ "%PDF-1.7" ], { type: "application/pdf" });
    const fn = vi.fn(async (_input?: unknown, _init?: RequestInit) => new Response(pdf, { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fn);
    const blob = await citizenApi.examPdf("ex 1", "p1");
    expect(blob.type).toBe("application/pdf");
    const [ url, init ] = fn.mock.calls[0] as unknown as [ string, RequestInit ];
    expect(url).toBe("/citizen/exams/ex%201/pdf?citizen_id=p1");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>).Accept).toBe("application/pdf");

    mockJson(404, { error: "not_found" });
    await expect(citizenApi.examPdf("ex1", "p1")).rejects.toEqual(new ApiError(404, "not_found"));

    mockJson(401, { error: "unauthenticated" });
    const spy = vi.spyOn(window, "dispatchEvent");
    await expect(citizenApi.examPdf("ex1", "p1")).rejects.toEqual(new ApiError(401, "unauthenticated"));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "citizen:unauthenticated" }));
  });

  it("history: status_label do exame passa; sem ele, a entrada fica como no módulo 20", async () => {
    mockJson(200, { verified: true, entries: [
      { id: "exam:ex1", kind: "exam", occurred_at: "2026-10-08T10:00:00-03:00", title: "Hemograma completo",
        status: "resulted", status_label: "Resultado disponível", document: { id: "ex1", downloadable: true } },
      { id: "triage:t1", kind: "triage", occurred_at: "2026-09-09T20:15:00-03:00", title: "Triagem respiratória" }
    ] });
    const h = await citizenApi.history("p1");
    expect(h.entries[0].status_label).toBe("Resultado disponível");
    expect(h.entries[0].document).toEqual({ id: "ex1", short_code: null, verification_url: null, downloadable: true });
    expect("status_label" in h.entries[1]).toBe(false);
  });
});
