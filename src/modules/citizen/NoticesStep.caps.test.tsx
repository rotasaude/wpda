// Módulo 31 (ADR 0049, decisão 4): nenhum aviso do CAPS chega à caixa de avisos (nem SMS: o canal não existe).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoticesStep } from "./NoticesStep";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function stubNotices() {
  const body = { unread_count: 1, notices: [
    { kind: "psychosocial", id: "n1", title: "CAPS AD Centro", body: "Seu atendimento no CAPS", read: false },
    { kind: "psychosocial_appointment", id: "n2", scheduled_at: "2026-11-05T09:00:00-03:00", read: false },
    { kind: "campaign", id: "n3", title: "Vacinação", body: "Campanha", dispatched_at: "2026-11-01T09:00:00-03:00", read: true }
  ] };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("/citizen/notices")) return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NoticesStep — nada do CAPS (módulo 31)", () => {
  it("Avisos: nada do CAPS na caixa", async () => {
    stubNotices();
    render(<NoticesStep onBack={vi.fn()} onPreferences={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /Vacinação/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CAPS|atendimento/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/CAPS|psicossocial|psychosocial|undefined/);
  });
});
