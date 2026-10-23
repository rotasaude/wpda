import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("cliente do acompanhamento (contrato §7)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const urlOf = (i = 0) => String(fetchMock.mock.calls[i][0]);
  const initOf = (i = 0) => fetchMock.mock.calls[i][1] as RequestInit;
  const bodyOf = (i = 0) => JSON.parse(String(initOf(i).body));

  it("declaredConditions: só o id na URL; normaliza a lista", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { conditions: [ { condition: "diabetes", declared_at: "2026-10-20T10:00:00-03:00" } ] }));
    expect(await citizenApi.declaredConditions("p1")).toEqual([ { condition: "diabetes", declared_at: "2026-10-20T10:00:00-03:00" } ]);
    expect(urlOf()).toBe("/citizen/declared_conditions?citizen_id=p1");
    expect(initOf().method).toBe("GET");
    fetchMock.mockResolvedValueOnce(reply(200, {}));
    expect(await citizenApi.declaredConditions("p1")).toEqual([]);
  });

  it("declareCondition: POST com a pessoa e a condição só no corpo, em JSON (201)", async () => {
    fetchMock.mockResolvedValueOnce(reply(201, { conditions: [ { condition: "hypertension", declared_at: "2026-10-22T09:00:00-03:00" } ] }));
    expect((await citizenApi.declareCondition("p1", "hypertension")).map((c) => c.condition)).toEqual([ "hypertension" ]);
    expect(urlOf()).toBe("/citizen/declared_conditions");
    expect(initOf().method).toBe("POST");
    expect((initOf().headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(bodyOf()).toEqual({ citizen_id: "p1", condition: "hypertension" });
  });

  it("withdrawCondition: DELETE com a condição no corpo; 204 relê a lista", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { conditions: [] }));
    expect(await citizenApi.withdrawCondition("p1", "pregnancy")).toEqual([]);
    expect(urlOf(0)).toBe("/citizen/declared_conditions?citizen_id=p1");
    expect(initOf(0).method).toBe("DELETE");
    expect(bodyOf(0)).toEqual({ condition: "pregnancy" });
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(reply(200, { conditions: [ { condition: "diabetes", declared_at: "2026-10-20T10:00:00-03:00" } ] }));
    expect((await citizenApi.withdrawCondition("p1", "pregnancy")).map((c) => c.condition)).toEqual([ "diabetes" ]);
    expect(initOf(2).method).toBe("GET");
  });

  it("care: só o id na URL; descarta campo a mais e normaliza o que falta", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { lines: [
      { name: "Pessoa com diabetes", reason: "problem", ciap: "T90",
        items: [ { label: "medir a pressão", status: "overdue", due_on: "2026-09-01", cid10: "E11" }, { label: "visita do agente" } ] },
      { items: [] }
    ], overdue_triages: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", last_done_at: "2025-10-02", reason: "x" } ] }));
    expect(await citizenApi.care("p1")).toEqual({ lines: [
      { name: "Pessoa com diabetes", items: [ { label: "medir a pressão", status: "overdue", due_on: "2026-09-01" }, { label: "visita do agente", status: "", due_on: null } ] },
      { name: "", items: [] }
    ], overdue_triages: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", last_done_at: "2025-10-02" } ] });
    fetchMock.mockResolvedValueOnce(reply(200, {}));
    expect(await citizenApi.care("p1")).toEqual({ lines: [], overdue_triages: [] });
    expect(urlOf()).toBe("/citizen/care?citizen_id=p1");
  });

  it("care: 403 not_verified vira ApiError com o código", async () => {
    fetchMock.mockResolvedValueOnce(reply(403, { error: "not_verified" }));
    await expect(citizenApi.care("p1")).rejects.toEqual(new ApiError(403, "not_verified"));
  });

  it("catalog: overdue false e last_done_at null quando faltam; true preservado", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, {
      available: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: null, overdue: true, last_done_at: "2025-10-02" },
        { protocol_name: "respiratoria", title: "Sintomas respiratórios", summary: null } ],
      suggested: [], recent: [], in_progress: null
    }));
    const c = await citizenApi.catalog("p1");
    expect(c.available).toEqual([
      { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: null, overdue: true, last_done_at: "2025-10-02" },
      { protocol_name: "respiratoria", title: "Sintomas respiratórios", summary: null, overdue: false, last_done_at: null }
    ]);
  });

  it("catalog: suggested também normaliza overdue e last_done_at (M1)", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, {
      available: [], recent: [], in_progress: null,
      suggested: [ { protocol_name: "a", title: "A", summary: null, suggestion_id: "s1", source_triage_id: "t0", source_title: "B", suggested_on: "2026-10-02" } ]
    }));
    const c = await citizenApi.catalog("p1");
    expect(c.suggested[0]).toMatchObject({ overdue: false, last_done_at: null });
  });
});
