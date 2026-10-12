import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError, HISTORY_PAGE_SIZE } from "./citizenApi";
import { hasSessionFeature, setSessionFeatures } from "./sessionFeatures";
import { setCityTimeZone } from "./format";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setCityTimeZone(null); setSessionFeatures(null); });

function mockJson(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const urlOf = (fn: ReturnType<typeof vi.fn>, i = 0) => new URL(String(fn.mock.calls[i][0]), "http://curitiba.localhost");

describe("citizenApi — Meu histórico (módulo 20)", () => {
  it("history: citizen_id, limit 20, kinds[] e o cursor como veio; nada pessoal na URL", async () => {
    const fn = mockJson(200, { verified: true, partial: false, entries: [], next_before: null });
    await citizenApi.history("p1");
    expect(urlOf(fn).pathname).toBe("/citizen/history");
    expect([ ...urlOf(fn).searchParams.entries() ]).toEqual([ [ "citizen_id", "p1" ], [ "limit", String(HISTORY_PAGE_SIZE) ] ]);

    await citizenApi.history("p 1", { before: "2026-09-10T14:40:00-03:00|clinical_document|doc2", kinds: [ "clinical_document" ] });
    const url = urlOf(fn, 1);
    expect(url.searchParams.get("citizen_id")).toBe("p 1");
    expect(url.searchParams.getAll("kinds[]")).toEqual([ "clinical_document" ]);
    expect(url.searchParams.get("before")).toBe("2026-09-10T14:40:00-03:00|clinical_document|doc2");
    expect(String(fn.mock.calls[1][0])).not.toMatch(/cpf|phone|\d{11}/i);
    expect((fn.mock.calls[0][1] as RequestInit).method).toBe("GET");
  });

  it("history: normaliza o que faltar (api mais novo ou incompleto)", async () => {
    mockJson(200, { entries: [
      { id: "triage:t1", kind: "triage", occurred_at: "2026-09-09T20:15:00-03:00", title: "Triagem respiratória" },
      { id: "clinical_document:doc2", kind: "clinical_document", occurred_at: "2026-09-10T14:40:00-03:00", title: "Receita",
        unit: { name: "UBS Centro" }, document: { id: "doc2", short_code: "P3H8T-2LQ6R" } }
    ] });
    const h = await citizenApi.history("p1");
    expect(h.verified).toBe(false);
    expect(h.partial).toBe(false);
    expect(h.next_before).toBeNull();
    expect(h.entries[0]).toEqual({
      id: "triage:t1", kind: "triage", occurred_at: "2026-09-09T20:15:00-03:00", unit: null, professional_name: null,
      title: "Triagem respiratória", summary: null, status: null, document: null
    });
    expect(h.entries[1].document).toEqual({ id: "doc2", short_code: "P3H8T-2LQ6R", verification_url: null, downloadable: false });
  });

  it("healthSummary: citizen_id, listas vazias e sinais ausentes viram vazio", async () => {
    const fn = mockJson(200, { problems: [ { terminology: "ciap2", code: "T90", label: "Diabetes" } ] });
    const s = await citizenApi.healthSummary("p1");
    expect(urlOf(fn).pathname).toBe("/citizen/health_summary");
    expect(urlOf(fn).searchParams.get("citizen_id")).toBe("p1");
    expect(s).toEqual({
      problems: [ { terminology: "ciap2", code: "T90", label: "Diabetes", since: null } ],
      medications: [], exam_requests: [], vitals: {}
    });
  });

  it("healthSummary: 404 not_available vira ApiError com o código", async () => {
    mockJson(404, { error: "not_available" });
    await expect(citizenApi.healthSummary("p1")).rejects.toEqual(new ApiError(404, "not_available"));
  });

  it("documentPdf: blob, recusa com código e 401", async () => {
    const pdf = new Blob([ "%PDF-1.7" ], { type: "application/pdf" });
    const fn = vi.fn(async () => new Response(pdf, { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fn);
    const blob = await citizenApi.documentPdf("doc2");
    expect(blob.type).toBe("application/pdf");
    const [ url, init ] = fn.mock.calls[0] as unknown as [ string, RequestInit ];
    expect(url).toBe("/citizen/documents/doc2/pdf");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>).Accept).toBe("application/pdf");

    mockJson(404, { error: "not_found" });
    await expect(citizenApi.documentPdf("doc2")).rejects.toEqual(new ApiError(404, "not_found"));

    mockJson(401, { error: "unauthenticated" });
    const spy = vi.spyOn(window, "dispatchEvent");
    await expect(citizenApi.documentPdf("doc2")).rejects.toEqual(new ApiError(401, "unauthenticated"));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "citizen:unauthenticated" }));
  });

  it("sessão: interruptores instalados; ausentes = nenhum; sair limpa", async () => {
    mockJson(200, { phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "patient_timeline", 3 ] });
    await citizenApi.currentSession();
    expect(hasSessionFeature("patient_timeline")).toBe(true);

    mockJson(200, { phone_masked: "(**) *****-5432" });
    await citizenApi.currentSession();
    expect(hasSessionFeature("patient_timeline")).toBe(false);

    mockJson(200, { phone_masked: "(**) *****-5432", features: [ "patient_timeline" ] });
    await citizenApi.verifyCode("41998765432", "123456");
    expect(hasSessionFeature("patient_timeline")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await citizenApi.signOut();
    expect(hasSessionFeature("patient_timeline")).toBe(false);
  });
});
