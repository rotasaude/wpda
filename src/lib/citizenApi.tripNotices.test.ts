// src/lib/citizenApi.tripNotices.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("citizenApi.notices — aviso de viagem (módulo 30, W5)", () => {
  it("notices: aviso de viagem perde destino e prestador", async () => {
    stubFetch(200, { unread_count: 1, notices: [ { kind: "trip", id: "n1", event: "departure_changed", date: "2026-11-05",
      departure_at: "2026-11-05T06:00:00-03:00", boarding: { label: "Praça da Matriz" }, destination_name: "Curitiba",
      provider_name: "Hospital Erasto Gaertner", procedure: "Radioterapia", read: false, cpf_masked: null } ] });
    expect((await citizenApi.notices()).notices).toEqual([ { kind: "trip", id: "n1", event: "departure_changed", date: "2026-11-05",
      departure_at: "2026-11-05T06:00:00-03:00", boarding_label: "Praça da Matriz", read: false, cpf_masked: null } ]);
  });

  it("notices: aviso de viagem sem data fica fora; sem embarque e sem hora vira null", async () => {
    stubFetch(200, { unread_count: 0, notices: [
      { kind: "trip", id: "n2", event: "reminder" },
      { kind: "trip", id: "n3", event: "added", date: "2026-11-05", read: true, cpf_masked: "***.982.247-**" }
    ] });
    expect((await citizenApi.notices()).notices).toEqual([ { kind: "trip", id: "n3", event: "added", date: "2026-11-05",
      departure_at: null, boarding_label: null, read: true, cpf_masked: "***.982.247-**" } ]);
  });
});
