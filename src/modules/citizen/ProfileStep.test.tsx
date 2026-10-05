import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileStep, VERIFIED_PROFILE_TEXT } from "./ProfileStep";
import { ApiError, citizenApi, type Person } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const declared: Person = {
  id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null,
  profile: { birth_date: "1963-04-02", sex: "female", gender_identity: null, profile_source: "declared" }
};
const verified: Person = {
  ...declared, verification_level: "verified",
  profile: { birth_date: "1963-04-02", sex: "female", gender_identity: "cis_woman", profile_source: "verified" }
};
const noProfile: Person = { ...declared, profile: null };

function setup(person: Person, required = false) {
  vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ person ] });
  const onSaved = vi.fn();
  const onBack = vi.fn();
  render(<ProfileStep citizenId="p1" required={required} onSaved={onSaved} onBack={onBack} />);
  return { onSaved, onBack };
}

describe("ProfileStep", () => {
  it("declared: 'Meu perfil' vem preenchido, salva e avisa o Flow", async () => {
    const set = vi.spyOn(citizenApi, "setProfile").mockResolvedValue(declared);
    const { onSaved } = setup(declared);
    await waitFor(() => {
      vi.runAllTimers();
      expect(screen.getByRole("heading", { name: "Meu perfil" })).toBeInTheDocument();
    });
    expect(screen.getByText("CPF ***.982.247-**")).toBeInTheDocument();
    const birth = screen.getByLabelText("Data de nascimento");
    expect(birth).toHaveValue("02/04/1963");
    await userEvent.clear(birth);
    await userEvent.type(birth, "03041963");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(set).toHaveBeenCalledWith("p1", { birth_date: "1963-04-03", sex: "female", gender_identity: null });
  });

  it("sem perfil (obrigatório): 'Sobre esta pessoa', campos vazios e 'Continuar'", async () => {
    const set = vi.spyOn(citizenApi, "setProfile").mockResolvedValue(declared);
    const { onSaved } = setup(noProfile, true);
    await waitFor(() => {
      vi.runAllTimers();
      expect(screen.getByRole("heading", { name: "Sobre esta pessoa" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue("");
    await userEvent.type(screen.getByLabelText("Data de nascimento"), "02041963");
    await userEvent.click(screen.getByRole("radio", { name: "Feminino" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(set).toHaveBeenCalledWith("p1", { birth_date: "1963-04-02", sex: "female", gender_identity: null });
  });

  it("verified: mostra o perfil conferido, sem campos nem 'Salvar'", async () => {
    const set = vi.spyOn(citizenApi, "setProfile");
    setup(verified);
    expect(await screen.findByText(VERIFIED_PROFILE_TEXT)).toBeInTheDocument();
    expect(screen.getByText("02/04/1963")).toBeInTheDocument();
    expect(screen.getByText("Feminino")).toBeInTheDocument();
    expect(screen.getByText("Mulher cis")).toBeInTheDocument();
    expect(screen.queryByLabelText("Data de nascimento")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
  });

  it("409 profile_verified (conferido no posto entre a leitura e o envio): relê e mostra só leitura com aviso", async () => {
    vi.spyOn(citizenApi, "people")
      .mockResolvedValueOnce({ people: [ declared ] })
      .mockResolvedValue({ people: [ verified ] });
    vi.spyOn(citizenApi, "setProfile").mockRejectedValue(new ApiError(409, "profile_verified"));
    const onSaved = vi.fn();
    render(<ProfileStep citizenId="p1" required={false} onSaved={onSaved} onBack={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(VERIFIED_PROFILE_TEXT)).toBeInTheDocument();
    expect(screen.getByText("Este perfil foi conferido no posto e só pode ser corrigido lá.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("422 do api aparece no formulário, sem sair da tela", async () => {
    vi.spyOn(citizenApi, "setProfile").mockRejectedValue(new ApiError(422, "invalid_birth_date"));
    const { onSaved } = setup(declared);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Data de nascimento inválida. Confira dia, mês e ano.")).toBeInTheDocument();
    expect(screen.getByLabelText("Data de nascimento")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("toque duplo em 'Salvar' grava uma vez só", async () => {
    let finish!: (p: Person) => void;
    const set = vi.spyOn(citizenApi, "setProfile").mockReturnValue(new Promise(r => { finish = r; }));
    setup(declared);
    const btn = await screen.findByRole("button", { name: "Salvar" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    finish(declared);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("pessoa fora da sessão: mensagem e 'Voltar'", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [] });
    const onBack = vi.fn();
    render(<ProfileStep citizenId="p1" required={false} onSaved={vi.fn()} onBack={onBack} />);
    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });
});
