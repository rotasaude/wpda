// Erros presos ao campo no celular e no código (WP-07).
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneStep } from "./PhoneStep";
import { CodeStep } from "./CodeStep";
import { ApiError, citizenApi } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

function boundError(field: HTMLElement, text: string) {
  expect(field).toHaveAttribute("aria-invalid", "true");
  const err = screen.getByText(text);
  expect(field.getAttribute("aria-describedby")).toContain(err.id);
  expect(document.activeElement).toBe(field);
}

describe("celular (WP-07)", () => {
  it("celular incompleto marca o campo e foca nele", async () => {
    render(<PhoneStep onSent={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Seu celular"), "4199");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    boundError(screen.getByLabelText("Seu celular"), "Digite um celular com DDD, como (41) 99876-5432.");
  });

  it("invalid_phone do api também vai para o campo", async () => {
    vi.spyOn(citizenApi, "requestCode").mockRejectedValue(new ApiError(422, "invalid_phone"));
    render(<PhoneStep onSent={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Seu celular"), "41998765432");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    boundError(await screen.findByLabelText("Seu celular"), "Digite um celular com DDD, como (41) 99876-5432.");
  });

  it("too_soon não é do campo: fica solto", async () => {
    vi.spyOn(citizenApi, "requestCode").mockRejectedValue(new ApiError(429, "too_soon"));
    render(<PhoneStep onSent={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Seu celular"), "41998765432");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    expect(await screen.findByText("Aguarde um minuto antes de pedir outro código.")).toBeInTheDocument();
    expect(screen.getByLabelText("Seu celular")).toHaveAttribute("aria-invalid", "false");
  });
});

describe("código (WP-07)", () => {
  it.each([ [ "invalid_code", "Código errado. Confira o SMS e tente de novo." ], [ "code_expired", "O código venceu. Peça um novo." ] ])(
    "%s marca o campo e foca nele", async (code, text) => {
      vi.spyOn(citizenApi, "verifyCode").mockRejectedValue(new ApiError(422, code));
      render(<CodeStep phone="(41) 99876-5432" onVerified={vi.fn()} onChangePhone={vi.fn()} />);
      await userEvent.type(screen.getByLabelText("Código"), "123456");
      await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await screen.findByText(text);
      boundError(screen.getByLabelText("Código"), text);
    });
});
