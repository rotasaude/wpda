import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneStep } from "./PhoneStep";
import { CodeStep } from "./CodeStep";
import { ConsentStep } from "./ConsentStep";
import { PeopleStep } from "./PeopleStep";
import { citizenApi, ApiError } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

describe("PhoneStep", () => {
  it("só envia celular válido, com máscara", async () => {
    const spy = vi.spyOn(citizenApi, "requestCode").mockResolvedValue({ status: "sent", resend_after: 60 });
    const onSent = vi.fn();
    render(<PhoneStep onSent={onSent} />);
    const input = screen.getByLabelText("Seu celular");
    await userEvent.type(input, "4133334444");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    expect(screen.getByText("Digite um celular com DDD, como (41) 99876-5432.")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "41998765432");
    expect(input).toHaveValue("(41) 99876-5432");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    expect(onSent).toHaveBeenCalledWith("(41) 99876-5432");
  });
});

describe("CodeStep", () => {
  it("mostra o erro de código errado", async () => {
    vi.spyOn(citizenApi, "verifyCode").mockRejectedValue(new ApiError(422, "invalid_code"));
    render(<CodeStep phone="(41) 99876-5432" onVerified={vi.fn()} onChangePhone={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Código"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Código errado. Confira o SMS e tente de novo.")).toBeInTheDocument();
  });
});

describe("ConsentStep", () => {
  it("aceita com a versão do termo", async () => {
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "3", body: "Texto do termo" });
    const onAccept = vi.fn();
    render(<ConsentStep onAccept={onAccept} onDecline={vi.fn()} />);
    expect(await screen.findByText("Texto do termo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concordo" }));
    expect(onAccept).toHaveBeenCalledWith("3");
  });
});

describe("PeopleStep", () => {
  it("escolhe uma pessoa da lista ou valida o CPF novo", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({
      people: [{ id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }]
    });
    const onChoose = vi.fn();
    render(<PeopleStep onChoose={onChoose} onHistory={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
    expect(onChoose).toHaveBeenCalledWith({ citizenId: "p1" });

    await userEvent.type(screen.getByLabelText("CPF de outra pessoa"), "52998224724");
    await userEvent.click(screen.getByRole("button", { name: "Continuar com este CPF" }));
    expect(screen.getByText("CPF inválido. Confira os números.")).toBeInTheDocument();
  });
});
