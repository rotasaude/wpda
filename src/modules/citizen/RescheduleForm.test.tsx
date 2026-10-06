import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RescheduleForm, RESCHEDULE_INTRO, noteLength } from "./RescheduleForm";
import { FROZEN_TEXT_NOTICE } from "./ui";
import { citizenApi, ApiError } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-06T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const rescheduled = { appointment: { id: "a1", scheduled_at: "2026-10-08T12:00:00Z", status: "cancelled_by_citizen" as const } };

function setup() {
  const onDone = vi.fn();
  const onClose = vi.fn();
  render(<RescheduleForm appointmentId="a1" onDone={onDone} onClose={onClose} />);
  return { onDone, onClose, submit: () => screen.getByRole("button", { name: "Pedir outro horário" }) };
}

async function choose(reason: string, period: string) {
  await userEvent.click(screen.getByRole("radio", { name: reason }));
  await userEvent.click(screen.getByRole("radio", { name: period }));
}

describe("RescheduleForm", () => {
  it("explica o que acontece e só libera o envio com motivo e período", async () => {
    const { submit } = setup();
    expect(screen.getByText(RESCHEDULE_INTRO)).toBeInTheDocument();
    for (const label of [ "Trabalho", "Saúde", "Transporte", "Outro motivo", "Manhã", "Tarde", "Qualquer período" ]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
    expect(submit()).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Trabalho" }));
    expect(submit()).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Tarde" }));
    expect(submit()).toBeEnabled();
  });

  it("envia motivo, período e nota e chama onDone", async () => {
    const spy = vi.spyOn(citizenApi, "requestReschedule").mockResolvedValue(rescheduled);
    const { onDone, submit } = setup();
    await choose("Trabalho", "Tarde");
    await userEvent.type(screen.getByLabelText("Quer explicar? (opcional)"), "Plantão");
    await userEvent.click(submit());
    expect(spy).toHaveBeenCalledWith("a1", { reasonCode: "work", preferredPeriod: "afternoon", note: "Plantão" });
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("nota opcional: sem nota, envia com a nota vazia (o cliente não manda a chave)", async () => {
    const spy = vi.spyOn(citizenApi, "requestReschedule").mockResolvedValue(rescheduled);
    const { submit } = setup();
    await choose("Transporte", "Qualquer período");
    await userEvent.click(submit());
    expect(spy).toHaveBeenCalledWith("a1", { reasonCode: "transport", preferredPeriod: "any", note: "" });
  });

  it("a nota mostra o aviso de texto congelado e o contador até 200", async () => {
    setup();
    const field = screen.getByLabelText("Quer explicar? (opcional)");
    expect(field).toHaveAccessibleDescription(FROZEN_TEXT_NOTICE);
    expect(field).toHaveAttribute("maxLength", "200");
    expect(screen.getByText("0/200")).toBeInTheDocument();
    await userEvent.type(field, "Plantão");
    expect(screen.getByText("7/200")).toBeInTheDocument();
  });

  it("409 not_reschedulable: mensagem própria, formulário segue aberto, sem onDone", async () => {
    vi.spyOn(citizenApi, "requestReschedule").mockRejectedValue(new ApiError(409, "not_reschedulable"));
    const { onDone, submit } = setup();
    await choose("Saúde", "Manhã");
    await userEvent.click(submit());
    expect(await screen.findByText("Este horário não pode mais ser trocado por aqui. Fale com a unidade.")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("toque duplo em 'Pedir outro horário' manda um POST só", async () => {
    const spy = vi.spyOn(citizenApi, "requestReschedule").mockReturnValue(new Promise(() => {}));
    const { submit } = setup();
    await choose("Outro motivo", "Tarde");
    const button = submit();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it("Voltar fecha sem enviar", async () => {
    const spy = vi.spyOn(citizenApi, "requestReschedule");
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("botões com alvo de toque >= 48 px e texto >= 18 px", () => {
    const { submit } = setup();
    for (const b of [ submit(), screen.getByRole("button", { name: "Voltar" }) ]) {
      expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
      expect(parseInt(b.style.fontSize, 10)).toBeGreaterThanOrEqual(18);
    }
  });
});

describe("noteLength", () => {
  it("conta depois do trim e por ponto de código (como o api)", () => {
    expect(noteLength("  Plantão  ")).toBe(7);
    expect(noteLength("ok 👍")).toBe(4);
    expect(noteLength("   ")).toBe(0);
  });
});
