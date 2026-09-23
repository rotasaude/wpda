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
});
