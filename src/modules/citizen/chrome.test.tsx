import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { A11yBar } from "./A11yBar";
import { A11yPage } from "./A11yPage";
import { CityHeader } from "./CityHeader";
import { EmergencyCall } from "./EmergencyCall";
import { Screen } from "./ui";
import { closeA11y, useA11yOpen } from "./a11yStore";
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

  it("CityHeader mostra o nome quando houver", () => {
    render(<CityHeader name="Curitiba" />);
    expect(screen.getByText("Curitiba")).toBeInTheDocument();
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
