// Correções da revisão final do subprojeto 4.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BigButton } from "./ui";
import { App } from "../../App";
import { Report } from "../Report";
import { closeA11y } from "./a11yStore";

afterEach(() => { closeA11y(); vi.unstubAllGlobals(); });

describe("revisão final", () => {
  it("desabilitado tem borda tracejada (distinto do secundário mesmo no alto contraste)", () => {
    render(<BigButton disabled>Continuar</BigButton>);
    expect(screen.getByRole("button", { name: "Continuar" }).style.border).toContain("dashed");
  });

  it("abrir Acessibilidade foca o título e Voltar devolve o foco ao link", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<App />);
    const link = screen.getByRole("link", { name: "Acessibilidade" });
    fireEvent.click(link);
    expect(document.activeElement?.textContent).toBe("Acessibilidade");
    expect(document.activeElement?.tagName).toBe("H1");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Acessibilidade" }));
  });

  it("botões voltam a ter o reset global (sem padding nem fundo do navegador, cursor de mão)", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../theme/global.css"), "utf8");
    expect(css).toMatch(/button\s*\{[^}]*padding:\s*0[^}]*\}/);
    expect(css).toMatch(/button\s*\{[^}]*cursor:\s*pointer[^}]*\}/);
    expect(css).toMatch(/button\s*\{[^}]*background:\s*transparent[^}]*\}/);
  });

  it("192 aparece também com o relatório carregando ou inválido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    render(<Report token="x" />);
    expect(screen.getByRole("link", { name: "Emergência? Ligar 192" })).toBeInTheDocument();
    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Emergência? Ligar 192" })).toBeInTheDocument();
  });
});
