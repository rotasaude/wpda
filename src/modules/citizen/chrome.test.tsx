import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { A11yBar } from "./A11yBar";
import { A11yPage } from "./A11yPage";
import { EmergencyCall } from "./EmergencyCall";
import { Screen } from "./ui";
import { closeA11y, openA11y, useA11yOpen } from "./a11yStore";
import { getChoice, toggleHighContrast } from "../../theme/theme";

afterEach(() => { closeA11y(); if (getChoice() !== "auto") toggleHighContrast(); });

function Harness() {
  const open = useA11yOpen();
  const [ n, setN ] = useState(0);
  return (
    <>
      <A11yBar />
      {open && <A11yPage />}
      <div hidden={open}>
        <Screen title="Pergunta">
          <button type="button" onClick={() => setN(n + 1)}>passo {n}</button>
        </Screen>
      </div>
    </>
  );
}

describe("topo, acessibilidade e 192", () => {
  it("192 é um link tel:", () => {
    render(<EmergencyCall />);
    expect(screen.getByRole("link", { name: "Emergência? Ligar 192" }).getAttribute("href")).toBe("tel:192");
  });

  it("Screen traz o topo da cidade com reserva e o 192", () => {
    render(<Screen title="Seu celular">x</Screen>);
    expect(screen.getByText("Rota Saúde")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Emergência? Ligar 192" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Seu celular" })).toBeInTheDocument();
  });

  it("Alto contraste tem aria-pressed", () => {
    render(<A11yBar />);
    const b = screen.getByRole("button", { name: "Alto contraste" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(b);
    expect(b.getAttribute("aria-pressed")).toBe("true");
  });

  it("Ir para o conteúdo foca o main sem mudar o histórico", () => {
    render(<Harness />);
    const before = window.history.length;
    fireEvent.click(screen.getByRole("link", { name: "Ir para o conteúdo" }));
    expect(document.activeElement?.tagName).toBe("MAIN");
    expect(window.history.length).toBe(before);
  });

  it("Acessibilidade sobrepõe e o Voltar devolve ao mesmo passo, sem perder estado", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "passo 0" }));
    fireEvent.click(screen.getByRole("link", { name: "Acessibilidade" }));
    expect(screen.getByRole("heading", { name: "Acessibilidade" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("button", { name: "passo 1" })).toBeVisible();
  });
});

describe("moldura — usabilidade (6e)", () => {
  it("192 é uma faixa fixa no rodapé, com borda (WP-01, A-17, WP-17)", () => {
    render(<Screen title="T">x</Screen>);
    const link = screen.getByRole("link", { name: "Emergência? Ligar 192" });
    const bar = link.closest("[data-emergency-bar]") as HTMLElement;
    expect(bar.style.position).toBe("fixed");
    expect(bar.style.bottom).toBe("0px");
    expect(link.style.border).toBe("2px solid var(--down)");
  });

  it("o main reserva o espaço da faixa (WP-01)", () => {
    render(<Screen title="T">x</Screen>);
    expect(screen.getByRole("main").style.paddingBottom).toBe("calc(96px + env(safe-area-inset-bottom))");
  });

  it("o main desconta a altura do topo: o rodapé fica acima da faixa sem rolar (WP-01)", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(113);
    render(<Screen title="T">x</Screen>);
    expect(screen.getByRole("main").style.minHeight).toBe("calc(100dvh - 113px)");
    spy.mockRestore();
  });

  it("o h1 recebe o foco ao montar e quando o título muda (WP-02)", () => {
    const { rerender } = render(<Screen title="Um">x</Screen>);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Um" }));
    screen.getByRole("heading", { level: 1 }).blur();
    rerender(<Screen title="Dois">x</Screen>);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Dois" }));
  });

  it("focusKey novo devolve o foco com o mesmo título (WP-02)", () => {
    const { rerender } = render(<Screen title="Igual" focusKey={1}>x</Screen>);
    screen.getByRole("heading", { level: 1 }).blur();
    rerender(<Screen title="Igual" focusKey={2}>x</Screen>);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("rola ao topo na troca de tela (WP-02)", () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    render(<Screen title="T">x</Screen>);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe("acessibilidade — usabilidade (6e)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("alvos de 48 px e fonte de 16 px na barra (WP-18)", () => {
    render(<A11yBar />);
    for (const el of [ screen.getByRole("link", { name: "Acessibilidade" }), screen.getByRole("button", { name: "Alto contraste" }) ]) {
      expect(el.style.minHeight).toBe("48px");
      expect(parseInt(el.style.fontSize || getComputedStyle(el.parentElement!).fontSize)).toBeGreaterThanOrEqual(16);
    }
  });

  it("com a página aberta, 'Ir para o conteúdo' foca o título dela (A-13)", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Acessibilidade" }));
    screen.getByRole("heading", { name: "Acessibilidade" }).blur();
    fireEvent.click(screen.getByRole("link", { name: "Ir para o conteúdo" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Acessibilidade" }));
  });

  it("abrir empilha uma entrada própria, uma vez só (A-14)", () => {
    render(<Harness />);
    const before = window.history.length;
    act(() => { openA11y(); openA11y(); });
    expect(window.history.state).toEqual({ a11y: true });
    expect(window.history.length).toBe(before + 1);
  });

  it("o 'voltar' do celular fecha a página e mantém o passo (A-14)", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "passo 0" }));
    fireEvent.click(screen.getByRole("link", { name: "Acessibilidade" }));
    act(() => { window.history.back(); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Acessibilidade" })).toBeNull());
    expect(screen.getByRole("button", { name: "passo 1" })).toBeVisible();
  });

  it("'Voltar' da página desfaz a própria entrada no histórico (A-14)", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Acessibilidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("heading", { name: "Acessibilidade" })).toBeNull();
    await waitFor(() => expect(window.history.state?.a11y).toBeFalsy());
  });
});
