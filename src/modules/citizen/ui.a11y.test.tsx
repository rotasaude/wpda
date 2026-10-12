import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BigButton, Field } from "./ui";

describe("componentes base: AA", () => {
  it("botão desabilitado segue desabilitado e sem opacidade", () => {
    render(<BigButton disabled>Continuar</BigButton>);
    const b = screen.getByRole("button", { name: "Continuar" });
    expect(b).toBeDisabled();
    expect(b.style.opacity).toBe("");
    expect(b.style.minHeight).toBe("56px");
  });

  it("erro do campo entra no aria-describedby junto da dica", () => {
    render(<Field label="CPF" hint="só números" error="CPF inválido." value="" onChange={() => {}} />);
    const input = screen.getByLabelText("CPF");
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toHaveLength(2);
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([ "só números", "CPF inválido." ]);
  });
});
