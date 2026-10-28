// src/lib/citizenApi.referrals.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("citizenApi.regulationRequests (contrato §9)", () => {
  it("só o id da pessoa na URL; GET sem corpo", async () => {
    const fetchMock = stubFetch(200, { requests: [] });
    expect(await citizenApi.regulationRequests("p1")).toEqual([]);
    const [ url, init ] = fetchMock.mock.calls[0] as unknown as [ string, RequestInit ];
    expect(url).toBe("/citizen/regulation_requests?citizen_id=p1");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("regulationRequests: só os campos do contrato sobrevivem", async () => {
    stubFetch(200, { requests: [ {
      id: "rr1", label: "Consulta em Cardiologia", status: "scheduled", scheduled_at: "2026-11-10T14:30:00-03:00",
      place: "Ambulatório de Especialidades — Rua XV, 100", updated_at: "2026-10-27T10:00:00-03:00",
      color: "red", suggested_color: "yellow", position: 3, cid10: "I209", justification: "Dor torácica", due_on: "2026-11-04",
      overdue: true, events: [ { status: "pending", reason: "x" } ], reason: "x"
    } ] });
    expect(await citizenApi.regulationRequests("p1")).toEqual([ {
      id: "rr1", label: "Consulta em Cardiologia", status: "scheduled", scheduled_at: "2026-11-10T14:30:00-03:00",
      place: "Ambulatório de Especialidades — Rua XV, 100", updated_at: "2026-10-27T10:00:00-03:00"
    } ]);
  });

  it("campos faltando viram nulo ou vazio; envelope ausente é lista vazia", async () => {
    stubFetch(200, { requests: [ { id: "rr2", status: "waiting" } ] });
    expect(await citizenApi.regulationRequests("p1")).toEqual([
      { id: "rr2", label: "", status: "waiting", scheduled_at: null, place: null, updated_at: "" } ]);
    stubFetch(200, {});
    expect(await citizenApi.regulationRequests("p1")).toEqual([]);
  });

  it("403 not_verified e feature_disabled chegam como ApiError com o código", async () => {
    stubFetch(403, { error: "not_verified" });
    await expect(citizenApi.regulationRequests("p1")).rejects.toEqual(new ApiError(403, "not_verified"));
    stubFetch(403, { error: "feature_disabled", feature: "care_regulation" });
    await expect(citizenApi.regulationRequests("p1")).rejects.toEqual(new ApiError(403, "feature_disabled"));
  });
});
