// src/lib/citizenApi.ombudsman.test.ts
// Módulo 33 (contrato §3, §4): ouvidoria no cliente. Só os campos do contrato passam;
// as rotas públicas nunca levam o cookie nem derrubam a sessão.
import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
function stubRaw(status: number, text: string | null) {
  const fetchMock = vi.fn(async () => new Response(text, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const sent = (m: ReturnType<typeof stubFetch>, i = 0) => {
  const [ url, init ] = m.mock.calls[i] as unknown as [ string, RequestInit ];
  return { url, init, body: init.body ? JSON.parse(init.body as string) : undefined };
};
const headerNames = (init: RequestInit) => Object.keys((init.headers ?? {}) as Record<string, string>).map(h => h.toLowerCase());

describe("citizenApi — ouvidoria pública (módulo 33, §4)", () => {
  it("publicConfig: sem cookie; unidades válidas; anonymous_web só com true", async () => {
    const m = stubFetch(200, { anonymous_web: "yes", units: [ { id: "u1", name: "UBS Centro" }, { id: 7 }, { name: "sem id" } ] });
    expect(await citizenApi.ombudsmanPublicConfig()).toEqual({ anonymous_web: false, units: [ { id: "u1", name: "UBS Centro" } ] });
    expect(sent(m).url).toBe("/citizen/ombudsman/public_config");
    expect(sent(m).init.credentials).toBe("omit");
    expect(headerNames(sent(m).init)).not.toContain("cookie");

    stubFetch(200, { anonymous_web: true, units: [ { id: "u2", name: "CAPS II", kind: "caps" } ], extra: 1 });
    expect(await citizenApi.ombudsmanPublicConfig()).toEqual({ anonymous_web: true, units: [ { id: "u2", name: "CAPS II" } ] });
  });

  it("anonymousReport: corpo exato, sem cookie e sem citizen:unauthenticated", async () => {
    const m = stubFetch(201, { ok: true, protocol: "2026-000999" });
    await expect(citizenApi.sendAnonymousReport({ body: "Faltou médico o dia todo na UBS.", healthUnitId: "u1" })).resolves.toBeUndefined();
    expect(sent(m)).toMatchObject({ url: "/citizen/ombudsman/anonymous_reports",
      body: { body: "Faltou médico o dia todo na UBS.", health_unit_id: "u1" } });
    expect(Object.keys(sent(m).body)).toEqual([ "body", "health_unit_id" ]);
    expect(sent(m).init.method).toBe("POST");
    expect(sent(m).init.credentials).toBe("omit");
    expect(headerNames(sent(m).init)).not.toContain("cookie");
    expect(sent(m).url).not.toMatch(/\.json|\?/);

    stubFetch(201, { ok: true });
    await citizenApi.sendAnonymousReport({ body: "Faltou médico o dia todo na UBS.", healthUnitId: null });
    const fetchMock = vi.mocked(fetch);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ body: "Faltou médico o dia todo na UBS." });
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("omit");

    const onUnauth = vi.fn();
    window.addEventListener("citizen:unauthenticated", onUnauth);
    stubFetch(401, { error: "unauthenticated" });
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: null })).rejects.toEqual(new ApiError(401, "unauthenticated"));
    stubFetch(401, { error: "unauthenticated" });
    await expect(citizenApi.ombudsmanPublicConfig()).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
    expect(onUnauth).not.toHaveBeenCalled();
    window.removeEventListener("citizen:unauthenticated", onUnauth);
  });

  it("anonymousReport: resposta vazia vira undefined; protocolo nunca volta", async () => {
    stubRaw(201, "");
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: null })).resolves.toBeUndefined();
    stubRaw(204, null);
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: null })).resolves.toBeUndefined();
  });

  it("anonymousReport: 429 e 403 viram ApiError com o código", async () => {
    stubFetch(429, { error: "daily_cap_reached" });
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: null })).rejects.toMatchObject({ status: 429, code: "daily_cap_reached" });
    stubFetch(403, { error: "feature_disabled", feature: "ombudsman" });
    await expect(citizenApi.ombudsmanPublicConfig()).rejects.toMatchObject({ status: 403, code: "feature_disabled" });
    stubRaw(413, "<html>413 Request Entity Too Large</html>");
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: null })).rejects.toMatchObject({ status: 413, code: "http_413" });
  });

  it("anonymousReport: 422 traz o path do campo", async () => {
    stubFetch(422, { error: "invalid_request", path: "health_unit_id", problems: [ { error: "invalid_request", path: "health_unit_id" } ] });
    await expect(citizenApi.sendAnonymousReport({ body: "x".repeat(20), healthUnitId: "u9" }))
      .rejects.toMatchObject({ status: 422, code: "invalid_request", path: "health_unit_id" });
  });
});

describe("citizenApi — minhas manifestações (módulo 33, §3)", () => {
  const SUMMARY = { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "preserved", state: "forwarded",
    received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "green", cpf_masked: "***.982.247-**", has_unread: true,
    subject: { name: "Atendimento" }, forwardings: [ { destination: "UBS Centro" } ] };

  it("manifestations: lista com os campos do contrato; cor desconhecida vira null", async () => {
    const m = stubFetch(200, { manifestations: [ SUMMARY, { ...SUMMARY, id: "m2", color: "blue", cpf_masked: undefined, has_unread: "1" } ] });
    const list = await citizenApi.manifestations();
    expect(sent(m).url).toBe("/citizen/ombudsman/manifestations");
    expect(sent(m).init.credentials).toBe("same-origin");
    expect(list[0]).toEqual({ id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "preserved", state: "forwarded",
      received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "green", cpf_masked: "***.982.247-**", has_unread: true });
    expect(list[1]).toMatchObject({ color: null, cpf_masked: null, has_unread: false });
    expect(JSON.stringify(list)).not.toMatch(/Atendimento|forwardings|UBS Centro/);
  });

  it("manifestations: as quatro cores passam; item sem id some; sem lista vira []", async () => {
    stubFetch(200, { manifestations: [ "yellow", "red", "paused" ].map((color, i) => ({ ...SUMMARY, id: `m${i}`, color }))
      .concat([ { ...SUMMARY, id: undefined as unknown as string } ]) });
    expect((await citizenApi.manifestations()).map(s => s.color)).toEqual([ "yellow", "red", "paused" ]);
    stubFetch(200, {});
    expect(await citizenApi.manifestations()).toEqual([]);
  });

  it("manifestation: só os campos do contrato", async () => {
    const m = stubFetch(200, { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "identified", state: "awaiting_complement",
      received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "paused", body: "Esperei 4 horas.", health_unit: { id: "u1", name: "UBS Centro" },
      attachments: [ { id: "a1", filename: "anexo-1.pdf", exam_file_id: "x" }, { filename: "sem id" } ],
      timeline: [ { kind: "received", at: "2026-11-10T09:00:00-03:00" }, { kind: "complement_requested", at: "2026-11-11T09:00:00-03:00", text: "Qual o horário?", actor_user: "Ana" } ],
      can_complement: true, can_request_reopen: "true", can_answer_satisfaction: false,
      extract: "Cidadã relata espera", subject: { name: "Atendimento" }, forwardings: [ { reply: "x" } ], responder_name: "Carlos" });
    const d = await citizenApi.manifestation("m1");
    expect(sent(m).url).toBe("/citizen/ombudsman/manifestations/m1");
    expect(d).toEqual({ id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "identified", state: "awaiting_complement",
      received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "paused", body: "Esperei 4 horas.", health_unit: { id: "u1", name: "UBS Centro" },
      attachments: [ { id: "a1" } ],
      timeline: [ { kind: "received", at: "2026-11-10T09:00:00-03:00", text: null },
        { kind: "complement_requested", at: "2026-11-11T09:00:00-03:00", text: "Qual o horário?" } ],
      can_complement: true, can_request_reopen: false, can_answer_satisfaction: false });
    expect(JSON.stringify(d)).not.toMatch(/extract|Atendimento|Carlos|Ana|forwardings|anexo-1/);
  });

  it("manifestation: o texto da linha do tempo só passa nos kinds que levam texto ao cidadão (api-shapes §2.2)", async () => {
    const at = "2026-11-11T09:00:00-03:00";
    const withText = [ "complement_requested", "extended", "interim_response", "final_response", "reopen_rejected", "archived" ];
    const withoutText = [ "received", "complement_received", "reopen_requested", "reopened", "forwarded", "internal_note" ];
    stubFetch(200, { id: "m1", timeline: [ ...withText, ...withoutText ].map(kind => ({ kind, at, text: `Encaminhada à Secretaria X (${kind})` })) });
    const d = await citizenApi.manifestation("m1");
    expect(d.timeline.filter(t => t.text !== null).map(t => t.kind)).toEqual(withText);
    expect(d.timeline.map(t => t.kind)).toEqual([ ...withText, ...withoutText ]);
  });

  it("manifestation: sem unidade, cor desconhecida e id na URL codificado", async () => {
    const m = stubFetch(200, { id: "m/1", protocol: "2026-000123", kind: "praise", identification_mode: "identified", state: "answered",
      received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: null, body: "Fui muito bem atendido.", health_unit: null,
      attachments: [], timeline: [], can_complement: false, can_request_reopen: true, can_answer_satisfaction: true });
    const d = await citizenApi.manifestation("m/1");
    expect(sent(m).url).toBe("/citizen/ombudsman/manifestations/m%2F1");
    expect(d).toMatchObject({ color: null, health_unit: null, attachments: [], timeline: [], can_request_reopen: true, can_answer_satisfaction: true });
  });

  it("escritas: corpo exato, citizen_id só no corpo, URL sem dado", async () => {
    let m = stubFetch(201, { id: "m9", protocol: "2026-000124", due_on: "2026-12-12", state: "received" });
    expect(await citizenApi.createManifestation({ who: { citizenId: "p2" }, kind: "report", mode: "preserved", body: "Texto com mais de vinte letras.",
      healthUnitId: null, attachmentIds: [ "a1" ] })).toEqual({ id: "m9", protocol: "2026-000124", due_on: "2026-12-12" });
    expect(sent(m)).toMatchObject({ url: "/citizen/ombudsman/manifestations", body: { citizen_id: "p2", kind: "report",
      identification_mode: "preserved", body: "Texto com mais de vinte letras.", attachment_ids: [ "a1" ] } });
    expect(sent(m).body).not.toHaveProperty("health_unit_id");
    expect(sent(m).body).not.toHaveProperty("cpf");
    expect(sent(m).body).not.toHaveProperty("full_name");
    expect(sent(m).init.credentials).toBe("same-origin");

    m = stubFetch(201, { id: "m9", protocol: "2026-000124", due_on: "2026-12-12" });
    await citizenApi.createManifestation({ who: { citizenId: "p2" }, kind: "complaint", mode: "identified", body: "Texto com mais de vinte letras.",
      healthUnitId: "u1", attachmentIds: [] });
    expect(sent(m).body).toEqual({ citizen_id: "p2", kind: "complaint", identification_mode: "identified",
      body: "Texto com mais de vinte letras.", health_unit_id: "u1" });

    m = stubFetch(200, {});
    await citizenApi.complementManifestation("m1", { body: "O horário foi 7h da manhã, na recepção.", attachmentIds: [] });
    expect(sent(m)).toMatchObject({ url: "/citizen/ombudsman/manifestations/m1/complement", body: { body: "O horário foi 7h da manhã, na recepção." } });
    expect(sent(m).body).not.toHaveProperty("attachment_ids");

    m = stubFetch(200, {});
    await expect(citizenApi.complementManifestation("m1", { body: "Segue a foto da fila.", attachmentIds: [ "a2", "a3" ] })).resolves.toBeUndefined();
    expect(sent(m).body).toEqual({ body: "Segue a foto da fila.", attachment_ids: [ "a2", "a3" ] });

    m = stubFetch(201, {});
    await expect(citizenApi.requestReopen("m1", "Ninguém me ligou de volta.")).resolves.toBeUndefined();
    expect(sent(m)).toMatchObject({ url: "/citizen/ombudsman/manifestations/m1/reopen_request", body: { reason: "Ninguém me ligou de volta." } });
    expect(sent(m).body).toEqual({ reason: "Ninguém me ligou de volta." });

    m = stubFetch(201, {});
    await expect(citizenApi.answerSatisfaction("m1", { met: "partly", clear: true, score: 4 })).resolves.toBeUndefined();
    expect(sent(m).url).toBe("/citizen/ombudsman/manifestations/m1/satisfaction");
    expect(sent(m).body).toEqual({ met: "partly", clear: true, score: 4 });

    m = stubFetch(201, { id: "a7", filename: "anexo-1.pdf" });
    expect(await citizenApi.uploadOmbudsmanAttachment({ filename: "anexo-1.pdf", contentType: "application/pdf", data: "JVBERi0=" })).toEqual({ id: "a7" });
    expect(sent(m).url).toBe("/citizen/ombudsman/attachments");
    expect(sent(m).body).toEqual({ filename: "anexo-1.pdf", content_type: "application/pdf", data: "JVBERi0=" });
    for (const c of vi.mocked(fetch).mock.calls) expect(String(c[0])).not.toContain("?");
  });

  it("createManifestation (U1): sem pessoa na sessão vai { cpf, full_name }, nunca citizen_id, nada na URL", async () => {
    const m = stubFetch(201, { id: "m10", protocol: "2026-000125", due_on: "2026-12-12" });
    await citizenApi.createManifestation({ who: { cpf: "529.982.247-25", fullName: "  Maria da Silva " }, kind: "complaint", mode: "identified",
      body: "Texto com mais de vinte letras.", healthUnitId: null, attachmentIds: [] });
    expect(sent(m).body).toEqual({ cpf: "52998224725", full_name: "Maria da Silva", kind: "complaint", identification_mode: "identified",
      body: "Texto com mais de vinte letras." });
    expect(sent(m).body).not.toHaveProperty("citizen_id");
    expect(sent(m).url).toBe("/citizen/ombudsman/manifestations");
    expect(sent(m).url).not.toMatch(/52998224725|Maria/);
  });

  it("uploadOmbudsmanAttachment: nome que não é anexo-N.ext não sai do aparelho", async () => {
    const m = stubFetch(201, { id: "a7" });
    for (const filename of [ "Laudo da Maria.pdf", "anexo-0.pdf", "anexo-1.gif", "IMG_2041.jpg" ])
      await expect(citizenApi.uploadOmbudsmanAttachment({ filename, contentType: "image/jpeg", data: "/9j/" })).rejects.toThrow();
    expect(m).not.toHaveBeenCalled();
    for (const filename of [ "anexo-2.jpg", "anexo-3.png" ])
      await citizenApi.uploadOmbudsmanAttachment({ filename, contentType: "image/jpeg", data: "/9j/" });
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("erros com sessão: path do 422 chega no ApiError; 401 derruba a sessão como antes", async () => {
    stubFetch(422, { error: "invalid_request", path: "body", problems: [ { error: "invalid_request", path: "body" } ] });
    await expect(citizenApi.createManifestation({ who: { citizenId: "p2" }, kind: "report", mode: "preserved", body: "curto",
      healthUnitId: null, attachmentIds: [] })).rejects.toMatchObject({ status: 422, code: "invalid_request", path: "body" });

    stubFetch(422, { error: "invalid_cpf", path: "cpf" });
    await expect(citizenApi.createManifestation({ who: { cpf: "111.111.111-11", fullName: "Maria" }, kind: "report", mode: "preserved",
      body: "Texto com mais de vinte letras.", healthUnitId: null, attachmentIds: [] })).rejects.toMatchObject({ code: "invalid_cpf", path: "cpf" });

    stubFetch(409, { error: "manifestation_changed", path: 7 });
    const err = await citizenApi.complementManifestation("m1", { body: "O horário foi 7h.", attachmentIds: [] }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "manifestation_changed", message: "manifestation_changed" });
    expect(err.path).toBeUndefined();

    const onUnauth = vi.fn();
    window.addEventListener("citizen:unauthenticated", onUnauth);
    stubFetch(401, { error: "unauthenticated" });
    await expect(citizenApi.manifestations()).rejects.toEqual(new ApiError(401, "unauthenticated"));
    expect(onUnauth).toHaveBeenCalledTimes(1);
    window.removeEventListener("citizen:unauthenticated", onUnauth);
  });

  it("ApiError: path é opcional e não muda status, code nem message", () => {
    const a = new ApiError(404, "not_found");
    expect(a).toMatchObject({ status: 404, code: "not_found", message: "not_found" });
    expect(a.path).toBeUndefined();
    expect(new ApiError(422, "invalid_request", "reason")).toMatchObject({ status: 422, code: "invalid_request", message: "invalid_request", path: "reason" });
  });

  it("notices: aviso ombudsman com evento, protocolo e data; sem texto", async () => {
    stubFetch(200, { unread_count: 2, notices: [
      { kind: "ombudsman", id: "o1", event: "final_response", protocol: "2026-000123", created_at: "2026-11-11T14:00:00-03:00", read: false,
        body: "Sua reclamação foi resolvida", text: "x" },
      { kind: "ombudsman", id: "o2", created_at: "2026-11-11T14:00:00-03:00" },
      { kind: "ombudsman", id: "o3" },
      { kind: "ombudsman", id: "o4", event: "reopen_decided", protocol: "2026-000124", created_at: "2026-11-12T08:00:00-03:00", read: true,
        cpf_masked: "***.982.247-**" }
    ] });
    const r = await citizenApi.notices();
    expect(r.notices).toEqual([
      { kind: "ombudsman", id: "o1", event: "final_response", protocol: "2026-000123", created_at: "2026-11-11T14:00:00-03:00", read: false, cpf_masked: null },
      { kind: "ombudsman", id: "o2", event: "", protocol: null, created_at: "2026-11-11T14:00:00-03:00", read: false, cpf_masked: null },
      { kind: "ombudsman", id: "o4", event: "reopen_decided", protocol: "2026-000124", created_at: "2026-11-12T08:00:00-03:00", read: true,
        cpf_masked: "***.982.247-**" }
    ]);
    expect(r.unread_count).toBe(2);
  });
});
