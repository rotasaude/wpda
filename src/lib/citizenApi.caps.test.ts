import { describe, it, expect, vi, afterEach } from "vitest";
import { citizenApi, isCapsOnlyKind, DOCUMENT_KINDS } from "./citizenApi";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Dados do CAPS que o api nunca deveria mandar (contrato §10): fonte psychosocial e o marcador da visão geral.
const CAPS_ACTION = { id: "psychosocial_action:a1", kind: "psychosocial_action", occurred_at: "2026-11-03T10:00:00-03:00",
  unit: { name: "CAPS AD Centro" }, professional_name: "Psic. Ana Lima", title: "Atendimento individual — F19.2", summary: "Sertralina 50 mg" };
const CAPS_MARKER = { id: "psychosocial_link:e1", kind: "psychosocial_link", occurred_at: "2026-10-01T00:00:00-03:00",
  unit: { name: "CAPS AD Centro" }, title: "Acompanhamento no CAPS AD Centro" };
const CAPS_BARE = { id: "psychosocial:x", kind: "psychosocial", occurred_at: "2026-10-02T00:00:00-03:00", title: "CAPS" };
const CONSULTATION = { id: "consultation:c1", kind: "consultation", occurred_at: "2026-10-20T09:00:00-03:00",
  unit: { name: "UBS Centro" }, title: "Consulta com Dra. Helena Prado" };
const PROCEDURE = { id: "procedure:p1", kind: "procedure", occurred_at: "2026-10-19T09:00:00-03:00", title: "Curativo" };

describe("citizenApi — nada do CAPS (módulo 31, decisão 4)", () => {
  it("isCapsOnlyKind: só o prefixo do CAPS", () => {
    expect([ "psychosocial", "psychosocial_action", "psychosocial_link", "psychosocial_enrollment" ].map(isCapsOnlyKind))
      .toEqual([ true, true, true, true ]);
    expect([ "procedure", "consultation", "clinical_document", "controlled_notification", "screening", "mental_health", "psychosocialx", "" ]
      .map(isCapsOnlyKind)).toEqual([ false, false, false, false, false, false, false, false ]);
  });

  it("history: entradas do CAPS saem antes da tela", async () => {
    stubFetch({ verified: true, partial: false, entries: [ CAPS_ACTION, CONSULTATION, CAPS_MARKER, PROCEDURE, CAPS_BARE ], next_before: "2026-10-01T00:00:00-03:00" });
    const h = await citizenApi.history("p1");
    expect(h.entries.map(e => e.id)).toEqual([ "consultation:c1", "procedure:p1" ]);
    expect(h.next_before).toBe("2026-10-01T00:00:00-03:00");
    expect(JSON.stringify(h)).not.toMatch(/CAPS|psychosocial|F19|Sertralina/);
  });

  it("history com kinds de documentos: o CAPS também sai", async () => {
    const fetchMock = stubFetch({ verified: true, partial: false,
      entries: [ { ...CAPS_ACTION, kind: "psychosocial_document" } ], next_before: null });
    const h = await citizenApi.history("p1", { kinds: DOCUMENT_KINDS });
    expect(h.entries).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe("/citizen/history?citizen_id=p1&kinds%5B%5D=clinical_document&limit=20");
  });

  it("notices: tipo do CAPS fica fora", async () => {
    stubFetch({ unread_count: 1, notices: [
      { kind: "psychosocial", id: "n1", title: "CAPS AD Centro", body: "Seu atendimento no CAPS", read: false },
      { kind: "psychosocial_appointment", id: "n2", scheduled_at: "2026-11-05T09:00:00-03:00", read: false },
      { kind: "campaign", id: "n3", title: "Vacinação", body: "Campanha", dispatched_at: "2026-11-01T09:00:00-03:00", read: true }
    ] });
    expect((await citizenApi.notices()).notices.map(n => n.id)).toEqual([ "n3" ]);
  });
});
