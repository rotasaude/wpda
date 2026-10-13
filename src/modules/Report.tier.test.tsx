// Nível do resultado com cor e forma (spec do subprojeto 4, §4.2); o texto
// do nível não muda.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Report } from "./Report";

afterEach(() => vi.unstubAllGlobals());

function report(tier: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    tier, priority: "1", recommendation: null, completed_at: null, expires_at: null
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
}

describe("nível do resultado", () => {
  it("'alta' ganha forma quadrada e o texto fica igual", async () => {
    report("alta");
    render(<Report token="t" />);
    const tag = await screen.findByText("Seu resultado: prioridade alta");
    expect(tag.getAttribute("data-glyph")).toBe("square");
    expect(tag.textContent).toBe("Seu resultado: prioridade alta");
    expect(tag.style.color).toBe("var(--down)");
  });

  it("'Média' (com acento e maiúscula) é moderado", async () => {
    report("Média");
    render(<Report token="t" />);
    const tag = await screen.findByText("Seu resultado: prioridade Média");
    expect(tag.getAttribute("data-glyph")).toBe("triangle");
    expect(tag.style.color).toBe("var(--warn)");
  });

  it("nível desconhecido fica neutro", async () => {
    report("azul");
    render(<Report token="t" />);
    const tag = await screen.findByText("Seu resultado: prioridade azul");
    expect(tag.hasAttribute("data-glyph")).toBe(false);
    expect(tag.style.color).toBe("var(--accent)");
  });
});
