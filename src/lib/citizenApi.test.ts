import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

afterEach(() => vi.unstubAllGlobals());

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

  it("start manda citizen_id ou cpf e a versão do termo", async () => {
    const fn = mockFetch(201, { conversation_id: "c", citizen_id: "p", resumed: false, step: {} });
    await citizenApi.start({ cpf: "529.982.247-25", consentVersion: "1" });
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ cpf: "529.982.247-25", consent_version: "1" });
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
});
