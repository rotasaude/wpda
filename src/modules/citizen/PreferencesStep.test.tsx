import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesStep, SMS_EXPLANATION, MUTE_EXPLANATION, EMPTY_PREFERENCES } from "./PreferencesStep";
import { citizenApi, type ContactPreference, type ContactPreferences } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const p1: ContactPreference = { citizen_id: "p1", cpf_masked: "***.982.247-**", sms_opt_in: false, notices_muted: false };
const p2: ContactPreference = { citizen_id: "p2", cpf_masked: "***.111.222-**", sms_opt_in: true, notices_muted: true };

function setup(prefs: ContactPreferences = { sms_available: true, people: [ p1, p2 ] }) {
  const get = vi.spyOn(citizenApi, "contactPreferences").mockResolvedValue(prefs);
  const put = vi.spyOn(citizenApi, "updateContactPreference");
  const onBack = vi.fn();
  const onSaved = vi.fn();
  render(<PreferencesStep onBack={onBack} onSaved={onSaved} />);
  return { get, put, onBack, onSaved };
}

const person = (cpf: string) => screen.findByRole("region", { name: `CPF ${cpf}` });
const smsSwitch = (el: HTMLElement) => within(el).getByRole("switch", { name: "Receber avisos por SMS" });
const muteSwitch = (el: HTMLElement) => within(el).getByRole("switch", { name: "Silenciar avisos" });

describe("PreferencesStep", () => {
  it.each([true, false])("sem nenhum cidadão (sms_available=%s): explica e não mostra interruptores, mantendo o voltar", async smsAvailable => {
    const { onBack } = setup({ sms_available: smsAvailable, people: [] });
    expect(await screen.findByText(EMPTY_PREFERENCES)).toBeInTheDocument();
    expect(EMPTY_PREFERENCES).toBe(
      "Você ainda não tem cadastro nesta cidade. Depois da sua primeira triagem, suas preferências de aviso aparecem aqui.");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("com SMS disponível: cada pessoa tem os dois interruptores, com o estado da API e as explicações", async () => {
    setup();
    const a = await person("***.982.247-**");
    expect(smsSwitch(a)).not.toBeChecked();
    expect(muteSwitch(a)).not.toBeChecked();
    expect(within(a).getByText(SMS_EXPLANATION)).toBeInTheDocument();
    expect(within(a).getByText(MUTE_EXPLANATION)).toBeInTheDocument();
    expect(SMS_EXPLANATION).toBe(
      "A Secretaria de Saúde pode enviar um SMS avisando que há um aviso novo aqui. Você pode desligar quando quiser.");

    const b = screen.getByRole("region", { name: "CPF ***.111.222-**" });
    expect(smsSwitch(b)).toBeChecked();
    expect(muteSwitch(b)).toBeChecked();
  });

  it("sem SMS na cidade: o interruptor de SMS não aparece; o de silêncio sim", async () => {
    setup({ sms_available: false, people: [ p1 ] });
    const a = await person("***.982.247-**");
    expect(within(a).queryByRole("switch", { name: "Receber avisos por SMS" })).not.toBeInTheDocument();
    expect(screen.queryByText(SMS_EXPLANATION)).not.toBeInTheDocument();
    expect(muteSwitch(a)).toBeInTheDocument();
  });

  it("ligar o SMS manda só sms_opt_in e mostra o estado salvo", async () => {
    const { put } = setup();
    put.mockResolvedValue({ ...p1, sms_opt_in: true });
    const a = await person("***.982.247-**");
    await userEvent.click(smsSwitch(a));

    expect(put).toHaveBeenCalledWith("p1", { sms_opt_in: true });
    expect(await within(a).findByText("Preferência salva.")).toBeInTheDocument();
    expect(smsSwitch(a)).toBeChecked();
    expect(muteSwitch(a)).not.toBeChecked();
  });

  it("silenciar manda só notices_muted e avisa o Flow (onSaved) para reler o selo", async () => {
    const { put, onSaved } = setup();
    put.mockResolvedValue({ ...p1, notices_muted: true });
    const a = await person("***.982.247-**");
    await userEvent.click(muteSwitch(a));

    expect(put).toHaveBeenCalledWith("p1", { notices_muted: true });
    expect(await within(a).findByText("Preferência salva.")).toBeInTheDocument();
    expect(muteSwitch(a)).toBeChecked();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("desligar o SMS de quem tinha ligado manda false", async () => {
    const { put } = setup();
    put.mockResolvedValue({ ...p2, sms_opt_in: false });
    const b = await person("***.111.222-**");
    await userEvent.click(smsSwitch(b));
    expect(put).toHaveBeenCalledWith("p2", { sms_opt_in: false });
    expect(await within(b).findByText("Preferência salva.")).toBeInTheDocument();
    expect(smsSwitch(b)).not.toBeChecked();
  });

  it("falha ao salvar: o interruptor volta, a seção mostra a mensagem e o Flow não é avisado", async () => {
    const { put, onSaved } = setup();
    put.mockRejectedValue(new TypeError("offline"));
    const a = await person("***.982.247-**");
    await userEvent.click(smsSwitch(a));

    expect(await within(a).findByText("Sem conexão. Verifique a internet e tente de novo.")).toBeInTheDocument();
    expect(smsSwitch(a)).not.toBeChecked();
    expect(smsSwitch(a)).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("toque duplo: um PUT só, e os interruptores ficam desabilitados enquanto salva", async () => {
    const { put } = setup();
    put.mockReturnValue(new Promise<ContactPreference>(() => {}));
    const a = await person("***.982.247-**");
    await userEvent.click(smsSwitch(a));
    await userEvent.click(smsSwitch(a));
    await userEvent.click(muteSwitch(screen.getByRole("region", { name: "CPF ***.111.222-**" })));

    expect(put).toHaveBeenCalledTimes(1);
    expect(smsSwitch(a)).toBeDisabled();
    expect(muteSwitch(a)).toBeDisabled();
  });

  it("erro ao carregar: mensagem e 'Tentar de novo' recarrega", async () => {
    const get = vi.spyOn(citizenApi, "contactPreferences")
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue({ sms_available: false, people: [ p1 ] });
    render(<PreferencesStep onBack={vi.fn()} />);
    expect(await screen.findByText("Sem conexão. Verifique a internet e tente de novo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await person("***.982.247-**")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("alvo de toque com pelo menos 48 px e texto com pelo menos 18 px; rodapé volta aos avisos", async () => {
    const { onBack } = setup();
    const label = muteSwitch(await person("***.982.247-**")).closest("label") as HTMLElement;
    expect(parseInt(label.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    expect(parseInt(label.style.fontSize, 10)).toBeGreaterThanOrEqual(18);
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
