// src/lib/citizenApi.trips.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, ApiError } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Real api shapes (api-surface.md §2): departure_at and boarding.label are never
// null; items[].id is the PASSENGER id (only a React key, never a trip id).
const RAW_TRIP = { id: "t1", date: "2026-11-05", departure_at: "2026-11-05T05:30:00-03:00",
  boarding: { label: "Praça da Matriz" }, destination: { name: "Curitiba", provider_name: "Hospital Erasto Gaertner" },
  status: "confirmed", companion: true };
const TRIP = { id: "t1", date: "2026-11-05", departure_at: "2026-11-05T05:30:00-03:00", boarding_label: "Praça da Matriz",
  destination_name: "Curitiba", provider_name: "Hospital Erasto Gaertner", status: "confirmed", companion: true };
const TFD = { id: "c1", status: "authorized", destination_name: "Curitiba", appointment_at: "2026-11-12T09:00:00-03:00",
  allowance_total_cents: 12345, paid: false };

describe("citizenApi.trips (contrato §8)", () => {
  it("trips: GET com só o citizen_id na URL", async () => {
    const fetchMock = stubFetch(200, { items: [], tfd: [] });
    await citizenApi.trips("p 1");
    expect(fetchMock.mock.calls[0][0]).toBe("/citizen/trips?citizen_id=p%201");
    expect(fetchMock.mock.calls[0][1]!.method).toBe("GET");
  });

  it("trips: só os campos do contrato", async () => {
    stubFetch(200, {
      items: [ { ...RAW_TRIP, procedure: "Radioterapia", cid10: "C50", specialty: "Oncologia",
        vehicle: { plate: "ABC1D23" }, driver: { name: "João Motorista" },
        destination: { ...RAW_TRIP.destination, address: "Rua Dr. Ovande do Amaral, 201" } } ],
      tfd: [ { ...TFD, report: { cid10: "C50", justification: "sem radioterapia no município" }, sigtap_code: "0304010022" } ]
    });
    expect(await citizenApi.trips("p1")).toEqual({ items: [ TRIP ], tfd: [ TFD ] });
  });

  it("trips: TFD em draft some", async () => {
    stubFetch(200, { items: [], tfd: [ { ...TFD, id: "d1", status: "draft" }, TFD ] });
    expect((await citizenApi.trips("p1")).tfd.map(c => c.id)).toEqual([ "c1" ]);
  });

  it("trips: valores inválidos viram seguros", async () => {
    stubFetch(200, {
      items: [ { id: "t2", date: "2026-11-06" }, { date: "2026-11-07" }, { id: "t3" } ],
      tfd: [ { id: "c2", allowance_total_cents: 10.5, paid: "yes" }, { id: "c3", allowance_total_cents: -100 }, { id: "c4", allowance_total_cents: 0 } ]
    });
    const d = await citizenApi.trips("p1");
    expect(d.items).toEqual([ { id: "t2", date: "2026-11-06", departure_at: null, boarding_label: null,
      destination_name: "", provider_name: null, status: "", companion: false } ]);
    expect(d.tfd.map(c => [ c.id, c.allowance_total_cents, c.paid ])).toEqual([ [ "c2", null, false ], [ "c3", null, false ], [ "c4", 0, false ] ]);
  });

  it("trips: corpo sem listas vira listas vazias", async () => {
    stubFetch(200, {});
    expect(await citizenApi.trips("p1")).toEqual({ items: [], tfd: [] });
  });

  it("trips: 403 not_verified vira ApiError", async () => {
    stubFetch(403, { error: "not_verified" });
    await expect(citizenApi.trips("p1")).rejects.toEqual(new ApiError(403, "not_verified"));
  });

  it("trips: 403 feature_disabled vira ApiError", async () => {
    stubFetch(403, { error: "feature_disabled", feature: "sanitary_transport" });
    await expect(citizenApi.trips("p1")).rejects.toEqual(new ApiError(403, "feature_disabled"));
  });
});
