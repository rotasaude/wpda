import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";
import { cityTimeZone, setCityTimeZone } from "./format";

afterEach(() => { vi.unstubAllGlobals(); setCityTimeZone(null); });

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" }
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("citizenApi", () => {
  it("POST manda JSON, com cookie da mesma origem", async () => {
    const fn = mockFetch(202, { status: "sent", resend_after: 60 });
    await citizenApi.requestCode("(41) 99876-5432");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/otp");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ phone: "(41) 99876-5432" });
  });

  it("erro vira ApiError com status e código", async () => {
    mockFetch(422, { error: "invalid_phone" });
    await expect(citizenApi.requestCode("x")).rejects.toEqual(new ApiError(422, "invalid_phone"));
  });

  it("204 devolve undefined", async () => {
    mockFetch(204);
    await expect(citizenApi.signOut()).resolves.toBeUndefined();
  });

  it("401 dispara citizen:unauthenticated e ainda rejeita com ApiError", async () => {
    mockFetch(401, { error: "unauthenticated" });
    const spy = vi.spyOn(window, "dispatchEvent");
    await expect(citizenApi.currentSession()).rejects.toEqual(new ApiError(401, "unauthenticated"));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "citizen:unauthenticated" }));
  });

  it("triages de uma api antiga sem attendance/check_in_available normaliza para null/false", async () => {
    const rawTriage: Record<string, unknown> = {
      id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
      completed_at: "2026-09-22T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null,
      attendance: { status: "open", unit_name: "UBS Centro", checked_in_at: "2026-09-24T12:00:00Z",
        outcome: null, referral_unit_name: null, referral_note: null, closed_at: null },
      check_in_available: true
    };
    // Guarda: confirma que as chaves realmente existiam antes de serem apagadas
    // (senão o teste não provaria nada sobre a normalização de ausência).
    expect("attendance" in rawTriage).toBe(true);
    expect("check_in_available" in rawTriage).toBe(true);
    delete rawTriage.attendance;
    delete rawTriage.check_in_available;
    expect("attendance" in rawTriage).toBe(false);
    expect("check_in_available" in rawTriage).toBe(false);

    mockFetch(200, {
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [rawTriage]
    });
    const result = await citizenApi.triages("p1");
    expect(result.triages[0].attendance).toBeNull();
    expect(result.triages[0].check_in_available).toBe(false);
  });

  it("triage() de uma api antiga sem attendance/check_in_available normaliza para null/false", async () => {
    const rawTriage: Record<string, unknown> = {
      id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
      completed_at: "2026-09-22T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null
    };
    expect("attendance" in rawTriage).toBe(false);
    expect("check_in_available" in rawTriage).toBe(false);
    mockFetch(200, rawTriage);
    const result = await citizenApi.triage("t1");
    expect(result.attendance).toBeNull();
    expect(result.check_in_available).toBe(false);
  });

  it("issueCheckInCode manda POST para check_in_code da triagem", async () => {
    const fn = mockFetch(201, { code: "123456", expires_at: "2026-09-24T12:10:00Z" });
    const result = await citizenApi.issueCheckInCode("t1");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/triages/t1/check_in_code");
    expect(init.method).toBe("POST");
    expect(result).toEqual({ code: "123456", expires_at: "2026-09-24T12:10:00Z" });
  });

  it("triages: attendance.status legado 'open' normaliza para 'waiting', called_at/request_kind ausentes viram null", async () => {
    mockFetch(200, {
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{
        id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
        completed_at: "2026-09-22T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null,
        attendance: { status: "open", unit_name: "UBS Centro", checked_in_at: "2026-09-24T12:00:00Z",
          outcome: null, referral_unit_name: null, referral_note: null, closed_at: null }
      }]
    });
    const result = await citizenApi.triages("p1");
    expect(result.triages[0].attendance?.status).toBe("waiting");
    expect(result.triages[0].attendance?.called_at).toBeNull();
    expect(result.triages[0].attendance?.request_kind).toBeNull();
  });

  it("triages: attendance.status 'in_care' já no formato novo não é alterado", async () => {
    mockFetch(200, {
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{
        id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
        completed_at: "2026-09-22T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null,
        attendance: { status: "in_care", unit_name: "UBS Centro", checked_in_at: "2026-09-24T12:00:00Z",
          called_at: "2026-09-24T12:05:00Z", request_kind: "return",
          outcome: null, referral_unit_name: null, referral_note: null, closed_at: null }
      }]
    });
    const result = await citizenApi.triages("p1");
    expect(result.triages[0].attendance?.status).toBe("in_care");
    expect(result.triages[0].attendance?.called_at).toBe("2026-09-24T12:05:00Z");
    expect(result.triages[0].attendance?.request_kind).toBe("return");
  });

  it("appointments manda GET com citizen_id e normaliza campos ausentes", async () => {
    const rawItem: Record<string, unknown> = {
      request: { id: "r1", kind: "return", target_unit_name: "UBS Centro", status: "open" },
      appointment: { id: "a1", scheduled_at: "2026-10-02T14:30:00Z", status: "scheduled" }
    };
    const fn = mockFetch(200, { appointments: [rawItem] });
    const result = await citizenApi.appointments("p1");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/appointments?citizen_id=p1");
    expect(init.method).toBe("GET");
    expect(result.appointments[0].request.closed_reason).toBeNull();
    expect(result.appointments[0].request.reopened_reason).toBeNull();
    expect(result.appointments[0].appointment?.confirmation_deadline_at).toBeNull();
    expect(result.appointments[0].appointment?.check_in_available).toBe(false);
  });

  it("appointments: appointment nulo permanece nulo depois da normalização", async () => {
    mockFetch(200, {
      appointments: [{
        request: { id: "r1", kind: "referral", target_unit_name: "UPA Norte", status: "open", closed_reason: null, reopened_reason: null },
        appointment: null
      }]
    });
    const result = await citizenApi.appointments("p1");
    expect(result.appointments[0].appointment).toBeNull();
  });

  it("confirmAppointment manda POST para confirm do agendamento", async () => {
    const fn = mockFetch(200, { appointment: { id: "a1", scheduled_at: "x", status: "confirmed" } });
    await citizenApi.confirmAppointment("a1");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/appointments/a1/confirm");
    expect(init.method).toBe("POST");
  });

  it("cancelAppointment manda POST com o motivo para cancel do agendamento", async () => {
    const fn = mockFetch(200, { appointment: { id: "a1", scheduled_at: "x", status: "cancelled_by_citizen" } });
    await citizenApi.cancelAppointment("a1", "não posso mais ir");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/appointments/a1/cancel");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "não posso mais ir" });
  });

  it("issueAppointmentCheckInCode manda POST para check_in_code do agendamento", async () => {
    const fn = mockFetch(201, { code: "123456", expires_at: "2026-09-24T12:10:00Z" });
    const result = await citizenApi.issueAppointmentCheckInCode("a1");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/appointments/a1/check_in_code");
    expect(init.method).toBe("POST");
    expect(result).toEqual({ code: "123456", expires_at: "2026-09-24T12:10:00Z" });
  });
  it("people normaliza neighborhood ausente para null e preserva o presente", async () => {
    mockFetch(200, { people: [
      { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" },
      { id: "p2", cpf_masked: "***.111.222-**", verification_level: "declared", neighborhood: { id: "n1", name: "Batel" } }
    ] });
    const { people } = await citizenApi.people();
    expect(people[0].neighborhood).toBeNull();
    expect(people[1].neighborhood).toEqual({ id: "n1", name: "Batel" });
  });

  it("neighborhoods devolve [] quando a resposta 200 vem sem a chave", async () => {
    mockFetch(200, {});
    expect(await citizenApi.neighborhoods()).toEqual([]);
  });

  it("neighborhoods faz GET /citizen/neighborhoods e desembrulha { neighborhoods }", async () => {
    const fn = mockFetch(200, { neighborhoods: [ { id: "n1", name: "Batel" } ] });
    expect(await citizenApi.neighborhoods()).toEqual([ { id: "n1", name: "Batel" } ]);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/neighborhoods");
    expect(init.method).toBe("GET");
  });

  it("setNeighborhood manda POST com o id ou null", async () => {
    const fn = mockFetch(200, {});
    await citizenApi.setNeighborhood("p1", null);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/people/p1/neighborhood");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ neighborhood_id: null });
  });

  it("setNeighborhood com bairro inválido rejeita com invalid_neighborhood", async () => {
    mockFetch(422, { error: "invalid_neighborhood" });
    await expect(citizenApi.setNeighborhood("p1", "n9")).rejects.toEqual(new ApiError(422, "invalid_neighborhood"));
  });

  it("triage() sem reference_units normaliza para [] e preserva a lista quando vem", async () => {
    const base = {
      id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-28T12:00:00Z",
      completed_at: "2026-09-28T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null
    };
    mockFetch(200, base);
    expect((await citizenApi.triage("t1")).reference_units).toEqual([]);

    const units = [ { id: "u1", name: "UBS Batel", kind: "ubs",
      address: { street: "Rua Padre Anchieta", number: null, complement: null, zip: null } } ];
    mockFetch(200, { ...base, reference_units: units });
    expect((await citizenApi.triage("t1")).reference_units).toEqual(units);
  });

  it("notices faz GET /citizen/notices e normaliza cpf_masked ausente para null", async () => {
    const fn = mockFetch(200, { notices: [
      { id: "r1", title: "Vacinação", body: "Texto", dispatched_at: "2026-09-28T13:00:00-03:00", read: false },
      { id: "r2", title: "Mutirão", body: "Texto", dispatched_at: "2026-09-27T13:00:00-03:00", read: true,
        cpf_masked: "***.982.247-**" }
    ], unread_count: 1 });
    const r = await citizenApi.notices();
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/notices");
    expect(init.method).toBe("GET");
    expect(r.unread_count).toBe(1);
    expect(r.notices.map(n => n.id)).toEqual([ "r1", "r2" ]);
    expect(r.notices[0].cpf_masked).toBeNull();
    expect(r.notices[1].cpf_masked).toBe("***.982.247-**");
    expect(r.notices[1].read).toBe(true);
  });

  it("notices sem lista nem unread_count vira lista vazia e zero", async () => {
    mockFetch(200, {});
    expect(await citizenApi.notices()).toEqual({ notices: [], unread_count: 0 });
  });

  it("readNotice faz POST no id do aviso, codificado", async () => {
    const fn = mockFetch(200, { ok: true });
    expect(await citizenApi.readNotice("r/1")).toEqual({ ok: true });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/notices/r%2F1/read");
    expect(init.method).toBe("POST");
  });

  it("readNotice de outro telefone rejeita com 404", async () => {
    mockFetch(404, { error: "not_found" });
    await expect(citizenApi.readNotice("r9")).rejects.toEqual(new ApiError(404, "not_found"));
  });

  it("contactPreferences faz GET e só liga sms_available com true explícito", async () => {
    const people = [ { citizen_id: "p1", cpf_masked: "***.982.247-**", sms_opt_in: false, notices_muted: true } ];
    const fn = mockFetch(200, { sms_available: true, people });
    expect(await citizenApi.contactPreferences()).toEqual({ sms_available: true, people });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/contact_preferences");
    expect(init.method).toBe("GET");

    mockFetch(200, { people });
    expect((await citizenApi.contactPreferences()).sms_available).toBe(false);
    mockFetch(200, {});
    expect(await citizenApi.contactPreferences()).toEqual({ sms_available: false, people: [] });
  });

  it("updateContactPreference manda PUT só com o campo mudado", async () => {
    const entry = { citizen_id: "p1", cpf_masked: "***.982.247-**", sms_opt_in: true, notices_muted: false };
    const fn = mockFetch(200, entry);
    expect(await citizenApi.updateContactPreference("p1", { sms_opt_in: true })).toEqual(entry);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/contact_preferences/p1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ sms_opt_in: true });
  });

  it("updateContactPreference de outro telefone rejeita com 404", async () => {
    mockFetch(404, { error: "not_found" });
    await expect(citizenApi.updateContactPreference("p9", { notices_muted: true }))
      .rejects.toEqual(new ApiError(404, "not_found"));
  });

  it("a sessão instala o fuso da cidade (api#27)", async () => {
    mockFetch(200, { phone_masked: "(**) *****-5432", time_zone: "America/Manaus" });
    await citizenApi.currentSession();
    expect(cityTimeZone()).toBe("America/Manaus");

    mockFetch(201, { phone_masked: "(**) *****-5432", time_zone: "America/Rio_Branco" });
    await citizenApi.verifyCode("(41) 99876-5432", "123456");
    expect(cityTimeZone()).toBe("America/Rio_Branco");

    mockFetch(200, { phone_masked: "(**) *****-5432" });
    await citizenApi.currentSession();
    expect(cityTimeZone()).toBe("America/Sao_Paulo");
  });
});

describe("citizenApi — módulo 15 (perfil, catálogo, sugestões)", () => {
  const profile = { birth_date: "1963-04-02", sex: "female" as const, gender_identity: null };
  const person = {
    id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" as const, neighborhood: null,
    profile: { ...profile, profile_source: "declared" as const }
  };

  it("people normaliza profile ausente para null e preserva o presente", async () => {
    mockFetch(200, { people: [ { id: "p0", cpf_masked: "***.111.222-**", verification_level: "declared" }, person ] });
    const { people } = await citizenApi.people();
    expect(people[0].profile).toBeNull();
    expect(people[1].profile).toEqual({ ...profile, profile_source: "declared" });
  });

  it("createPerson manda CPF, termo e perfil, sem bairro quando não veio", async () => {
    const fn = mockFetch(201, { person });
    const result = await citizenApi.createPerson({ cpf: "529.982.247-25", consentVersion: "3", profile });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/people");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      cpf: "529.982.247-25", consent_version: "3", birth_date: "1963-04-02", sex: "female", gender_identity: null
    });
    expect(result.id).toBe("p1");
    expect(result.profile?.profile_source).toBe("declared");
  });

  it("createPerson manda neighborhood_id quando veio", async () => {
    const fn = mockFetch(201, { person });
    await citizenApi.createPerson({ cpf: "529.982.247-25", consentVersion: "3", profile, neighborhoodId: "n1" });
    const body = JSON.parse((fn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.neighborhood_id).toBe("n1");
  });

  it("createPerson (200, par que já existia) normaliza profile e neighborhood ausentes", async () => {
    mockFetch(200, { person: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" } });
    const result = await citizenApi.createPerson({ cpf: "529.982.247-25", consentVersion: "3", profile });
    expect(result.profile).toBeNull();
    expect(result.neighborhood).toBeNull();
  });

  it("createPerson 409 consent_outdated vira ApiError", async () => {
    mockFetch(409, { error: "consent_outdated" });
    await expect(citizenApi.createPerson({ cpf: "529.982.247-25", consentVersion: "2", profile }))
      .rejects.toEqual(new ApiError(409, "consent_outdated"));
  });

  it("setProfile manda só os três campos, com gender_identity null explícito", async () => {
    const fn = mockFetch(200, { person });
    const result = await citizenApi.setProfile("p1", profile);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/people/p1/profile");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ birth_date: "1963-04-02", sex: "female", gender_identity: null });
    expect("gender_identity" in body).toBe(true);
    expect(result.id).toBe("p1");
  });

  it("setProfile 409 profile_verified vira ApiError", async () => {
    mockFetch(409, { error: "profile_verified" });
    await expect(citizenApi.setProfile("p1", profile)).rejects.toEqual(new ApiError(409, "profile_verified"));
  });

  it("nenhuma URL carrega dado de perfil", async () => {
    const fn = mockFetch(200, { person });
    await citizenApi.setProfile("p1", { birth_date: "1963-04-02", sex: "female", gender_identity: "trans_woman" });
    await citizenApi.createPerson({ cpf: "529.982.247-25", consentVersion: "3", profile });
    for (const call of fn.mock.calls) {
      expect(String((call as unknown[])[0])).not.toMatch(/1963|female|trans_woman|birth|sex|gender/);
    }
  });

  it("catalog faz GET em /people/:id/catalog e preserva o que veio", async () => {
    const full = {
      in_progress: { conversation_id: "c1", protocol_name: "triage-respiratoria", title: "Sintomas respiratórios" },
      suggested: [ { protocol_name: "saude-mental-aprofundada", title: "Saúde mental — aprofundamento", summary: "Mais perguntas.",
        suggestion_id: "s1", source_triage_id: "t0", source_title: "Saúde mental", suggested_on: "2026-10-02" } ],
      available: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Quedas, memória e medicamentos." } ],
      recent: [ { protocol_name: "saude-mental", title: "Saúde mental", summary: null,
        last_completed_on: "2026-10-02", next_available_on: "2027-04-02" } ],
      reference_units: [ { id: "u1", name: "UBS Batel", kind: "ubs",
        address: { street: null, number: null, complement: null, zip: null } } ]
    };
    const fn = mockFetch(200, full);
    expect(await citizenApi.catalog("p1")).toEqual(full);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/people/p1/catalog");
    expect(init.method).toBe("GET");
  });

  it("catalog normaliza chaves ausentes (api anterior ou campo opcional)", async () => {
    mockFetch(200, { suggested: [ { protocol_name: "a", title: "A", suggestion_id: "s1", source_triage_id: "t0", source_title: "Saúde mental", suggested_on: "2026-10-02" } ] });
    expect(await citizenApi.catalog("p1")).toEqual({
      in_progress: null,
      suggested: [ { protocol_name: "a", title: "A", summary: null, suggestion_id: "s1", source_triage_id: "t0", source_title: "Saúde mental", suggested_on: "2026-10-02" } ],
      available: [], recent: [], reference_units: []
    });
  });

  it("catalog: suggested sem source_title normaliza para null", async () => {
    mockFetch(200, { suggested: [ { protocol_name: "a", title: "A", suggestion_id: "s1", source_triage_id: "t0", suggested_on: "2026-10-02" } ] });
    expect((await citizenApi.catalog("p1")).suggested[0].source_title).toBeNull();
  });

  it("catalog 409 profile_required vira ApiError", async () => {
    mockFetch(409, { error: "profile_required" });
    await expect(citizenApi.catalog("p1")).rejects.toEqual(new ApiError(409, "profile_required"));
  });

  it("startTriage manda citizen_id, protocol_name e a versão do termo, nada mais", async () => {
    const fn = mockFetch(201, { conversation_id: "c", citizen_id: "p1", resumed: false, step: {} });
    await citizenApi.startTriage({ citizenId: "p1", protocolName: "saude-do-idoso", consentVersion: "3" });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/citizen/conversations");
    expect(JSON.parse(init.body as string)).toEqual({ citizen_id: "p1", protocol_name: "saude-do-idoso", consent_version: "3" });
  });

  it("triage() sem suggestions normaliza para []; com a lista, normaliza summary ausente", async () => {
    const base = {
      id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-10-05T12:00:00Z",
      completed_at: "2026-10-05T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null
    };
    mockFetch(200, base);
    expect((await citizenApi.triage("t1")).suggestions).toEqual([]);
    mockFetch(200, { ...base, suggestions: [ { suggestion_id: "s1", protocol_name: "b", title: "B" } ] });
    expect((await citizenApi.triage("t1")).suggestions).toEqual([ { suggestion_id: "s1", protocol_name: "b", title: "B", summary: null } ]);
  });
});
