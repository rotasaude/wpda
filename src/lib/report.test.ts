import { describe, it, expect, vi, afterEach } from "vitest";
import { tokenFromUrl, fetchReport } from "./report";

describe("tokenFromUrl", () => {
  it("extrai ?token", () => { expect(tokenFromUrl("?token=abc")).toBe("abc"); });
  it("null quando ausente", () => { expect(tokenFromUrl("")).toBe(null); });
  it("null quando vazio", () => { expect(tokenFromUrl("?token=")).toBe(null); });
});

afterEach(() => vi.unstubAllGlobals());

function mockFetch(status: number, body?: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    body !== undefined ? JSON.stringify(body) : "",
    { status, headers: { "Content-Type": "application/json" } }
  )));
}

describe("fetchReport", () => {
  it("devolve Report em 200", async () => {
    mockFetch(200, { tier: "rotina", priority: "baixa", summary: "ok", completed_at: "2026-06-26T12:00:00Z", expires_at: null });
    const r = await fetchReport("abc");
    expect(r?.summary).toBe("ok");
  });
  it("null em 404", async () => { mockFetch(404); expect(await fetchReport("x")).toBe(null); });
  it("lança em 500", async () => { mockFetch(500); await expect(fetchReport("x")).rejects.toThrow(); });
});
