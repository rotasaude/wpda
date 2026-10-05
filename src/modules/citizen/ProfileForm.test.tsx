import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROFILE_PURPOSE, ProfileForm } from "./ProfileForm";
import { citizenApi } from "../../lib/citizenApi";
import { BIRTH_DATE_FUTURE, BIRTH_DATE_INVALID, BIRTH_DATE_TOO_OLD, SEX_REQUIRED } from "../../lib/profile";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

type Props = Parameters<typeof ProfileForm>[0];

function setup(props: Partial<Props> = {}) {
  const onSubmit = vi.fn();
  const onBack = vi.fn();
  const view = render(<ProfileForm title="Sobre esta pessoa" submitLabel="Continuar"
    onSubmit={onSubmit} onBack={onBack} {...props} />);
  return { onSubmit, onBack, ...view };
}

const birth = () => screen.getByLabelText("Data de nascimento");
const submit = () => userEvent.click(screen.getByRole("button", { name: "Continuar" }));

describe("ProfileForm", () => {
  it("sem nada preenchido: aponta os dois campos e não envia", async () => {
    const { onSubmit } = setup();
    await submit();
    expect(screen.getByText(BIRTH_DATE_INVALID)).toBeInTheDocument();
    expect(screen.getByText(SEX_REQUIRED)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("mascara a data e envia; identidade de gênero começa em 'Prefiro não informar' (null)", async () => {
    const { onSubmit } = setup();
    await userEvent.type(birth(), "02041963");
    expect(birth()).toHaveValue("02/04/1963");
    expect(screen.getByRole("radio", { name: "Prefiro não informar" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Feminino" }));
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({ birth_date: "1963-04-02", sex: "female", gender_identity: null });
  });

  it("identidade de gênero escolhida vai com o valor do contrato", async () => {
    const { onSubmit } = setup();
    await userEvent.type(birth(), "02041963");
    await userEvent.click(screen.getByRole("radio", { name: "Feminino" }));
    await userEvent.click(screen.getByRole("radio", { name: "Mulher trans" }));
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({ birth_date: "1963-04-02", sex: "female", gender_identity: "trans_woman" });
  });

  it("data futura, data que não existe e idade acima de 130 são recusadas na hora", async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole("radio", { name: "Masculino" }));
    await userEvent.type(birth(), "06102026");
    await submit();
    expect(screen.getByText(BIRTH_DATE_FUTURE)).toBeInTheDocument();
    await userEvent.clear(birth());
    await userEvent.type(birth(), "31022000");
    await submit();
    expect(screen.getByText(BIRTH_DATE_INVALID)).toBeInTheDocument();
    await userEvent.clear(birth());
    await userEvent.type(birth(), "05101895");
    await submit();
    expect(screen.getByText(BIRTH_DATE_TOO_OLD)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("às 23h30 de Brasília, quem nasceu hoje passa", async () => {
    vi.setSystemTime(new Date("2026-10-05T23:30:00-03:00"));
    const { onSubmit } = setup();
    await userEvent.type(birth(), "05102026");
    await userEvent.click(screen.getByRole("radio", { name: "Feminino" }));
    await submit();
    expect(onSubmit).toHaveBeenCalledWith({ birth_date: "2026-10-05", sex: "female", gender_identity: null });
  });

  it("perfil existente vem preenchido", () => {
    setup({ initial: { birth_date: "1963-04-02", sex: "male", gender_identity: "cis_man" } });
    expect(birth()).toHaveValue("02/04/1963");
    expect(screen.getByRole("radio", { name: "Masculino" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Homem cis" })).toBeChecked();
  });

  it("mostra quem é, a finalidade e abre o termo sem sair da tela", async () => {
    const term = vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "3", body: "Texto do termo" });
    setup({ who: "CPF ***.982.247-**" });
    expect(screen.getByText("CPF ***.982.247-**")).toBeInTheDocument();
    expect(screen.getByText(PROFILE_PURPOSE)).toBeInTheDocument();
    expect(term).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ler o termo de consentimento" }));
    expect(await screen.findByText("Texto do termo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar o termo" })).toHaveAttribute("aria-expanded", "true");
  });

  it("sem <form> nativo e sem preenchimento automático da data", () => {
    const { container } = setup();
    expect(container.querySelector("form")).toBeNull();
    expect(birth()).toHaveAttribute("autocomplete", "off");
  });

  it("erro vindo do api aparece; 'Voltar' não envia", async () => {
    const { onSubmit, onBack } = setup({ error: "Data de nascimento inválida. Confira dia, mês e ano." });
    expect(screen.getByText("Data de nascimento inválida. Confira dia, mês e ano.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ocupado: botões e opções desabilitados", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Feminino" })).toBeDisabled();
  });

  it("cada opção é um alvo de 48 px com texto de 18 px", () => {
    setup();
    const label = screen.getByRole("radio", { name: "Feminino" }).closest("label") as HTMLElement;
    expect(label.style.minHeight).toBe("48px");
    expect(label.style.fontSize).toBe("18px");
  });
});
