import { afterEach, describe, expect, it } from "vitest";
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
