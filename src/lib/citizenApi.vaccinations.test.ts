import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const DOSE = { immunobiological_name: "Pentavalente", dose_name: "2ª dose", applied_on: "2026-09-10",
  place_name: "UBS Vila Verde", transcription: false, rnds: "sent" };

describe("citizenApi.vaccinations (contrato §9)", () => {
  it("vaccinations: GET com só o citizen_id na URL", async () => {
    const fetchMock = stubFetch(200, { checked: true, items: [], upcoming: [] });
    await citizenApi.vaccinations("p 1");
    expect(fetchMock.mock.calls[0][0]).toBe("/citizen/vaccinations?citizen_id=p%201");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("GET");
  });

  it("vaccinations: só os campos do contrato; cancelada some", async () => {
    stubFetch(200, { checked: true, upcoming: [], items: [
      { ...DOSE, lot: { number: "AB123" }, manufacturer: "Serum", by: { name: "Ana", cbo: "322205" }, id: "im1" },
      { ...DOSE, dose_name: "1ª dose", status: "cancelled" },
      { ...DOSE, dose_name: "3ª dose", rnds: "blocked" }
    ] });
    const d = await citizenApi.vaccinations("p1");
    expect(d.items).toEqual([ DOSE, { ...DOSE, dose_name: "3ª dose", rnds: null } ]);
  });

  it("vaccinations: sem conferência, upcoming vira []", async () => {
    stubFetch(200, { checked: false, items: [], upcoming: [ { immunobiological_name: "Tríplice viral", dose_name: "1ª dose", due_on: "2026-08-01" } ] });
    expect(await citizenApi.vaccinations("p1")).toEqual({ checked: false, items: [], upcoming: [] });
  });

  it("vaccinations: campos ausentes viram valores seguros", async () => {
    stubFetch(200, { checked: true, items: [ { immunobiological_name: "BCG" } ], upcoming: [ { dose_name: "Reforço" } ] });
    expect(await citizenApi.vaccinations("p1")).toEqual({
      checked: true,
      items: [ { immunobiological_name: "BCG", dose_name: "", applied_on: "", place_name: null, transcription: false, rnds: null } ],
      upcoming: [ { immunobiological_name: "", dose_name: "Reforço", due_on: null } ]
    });
  });

  it("vaccinations: 403 not_verified vira ApiError", async () => {
    stubFetch(403, { error: "not_verified" });
    await expect(citizenApi.vaccinations("p1")).rejects.toEqual(new ApiError(403, "not_verified"));
  });
});
