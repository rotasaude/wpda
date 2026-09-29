import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("App — link público /r/:token", () => {
  it("mostra Voltar ao início apontando para / dentro do cartão, sem unidade nem bairro", async () => {
    window.history.replaceState(null, "", "/?token=abc");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      tier: "alta", priority: "1", recommendation: { title: "Procure a UPA", body: "Hoje." },
      completed_at: null, expires_at: null,
      reference_units: [ { id: "u1", name: "UBS Batel", kind: "ubs", address: { street: null, number: null, complement: null, zip: null } } ]
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(<App />);

    const link = await screen.findByRole("link", { name: "Voltar ao início" });
    expect(link).toHaveAttribute("href", "/");
    expect(link.closest("article")).not.toBeNull();
    expect(parseInt(link.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    expect(screen.queryByText("UBS Batel")).not.toBeInTheDocument();
    expect(screen.queryByText(/unidade de referência|unidades de referência|bairro/i)).not.toBeInTheDocument();
  });
});
