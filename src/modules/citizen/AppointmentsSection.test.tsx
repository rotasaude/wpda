import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentsSection, RESCHEDULE_REQUESTED } from "./AppointmentsSection";
import { FROZEN_TEXT_NOTICE } from "./ui";
import { citizenApi, ApiError, type AppointmentItem } from "../../lib/citizenApi";

// Relógio fixo antes dos prazos das fixtures (2026-10-01 14:30): a tela
// esconde "Confirmar" depois do prazo, então o relógio real quebraria os
// testes quando a data passasse. Só Date é falso: os timers do findBy seguem reais.
beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-09-30T10:00:00-03:00"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Mesma formatação da spec (item 9): weekday/day/month/hour/minute no fuso
// da cidade. Usada aqui para montar o texto esperado sem depender do fuso
// da máquina que roda o teste (a suíte fixa TZ=America/Sao_Paulo).
function fmt(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

function mockAppointments(appointments: AppointmentItem[]) {
  return vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments });
}

const openReturn: AppointmentItem = {
  request: { id: "r1", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: null },
  appointment: null
};

describe("AppointmentsSection", () => {
  it("1. sem pedidos, não renderiza nada", async () => {
    mockAppointments([]);
    const { container } = render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await vi.waitFor(() => expect(citizenApi.appointments).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("1b. com pedidos, mostra o título 'Seus agendamentos'", async () => {
    mockAppointments([openReturn]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Seus agendamentos" })).toBeInTheDocument();
  });

  it("2. pedido aberto de retorno", async () => {
    mockAppointments([openReturn]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Retorno pedido na UBS Centro — a unidade vai marcar o horário")).toBeInTheDocument();
  });

  it("2. pedido aberto de encaminhamento", async () => {
    mockAppointments([{
      request: { id: "r2", kind: "referral", target_unit_name: "UPA Norte", status: "open", closed_reason: null, reopened_reason: null },
      appointment: null
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Encaminhamento para UPA Norte — a unidade vai marcar o horário")).toBeInTheDocument();
  });

  it("3. horário 'scheduled' mostra data, unidade, prazo de confirmação e os botões Confirmar/Cancelar", async () => {
    mockAppointments([{
      request: { id: "r4", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a1", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    const scheduledAt = fmt("2026-10-02T14:30:00-03:00");
    const deadline = fmt("2026-10-01T14:30:00-03:00");
    expect(await screen.findByText(`Agendado: ${scheduledAt} — UBS Centro. Confirme até ${deadline}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("3b. depois do prazo, some o Confirmar e avisa que a unidade pode marcar outro horário", async () => {
    vi.setSystemTime(new Date("2026-10-01T14:30:00-03:00"));
    mockAppointments([{
      request: { id: "r4", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a1", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(
      "O prazo para confirmar terminou. A unidade pode marcar outro horário."
    )).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("4. horário 'confirmed' mostra data, unidade e o botão Cancelar, sem check-in se indisponível", async () => {
    mockAppointments([{
      request: { id: "r5", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a2", scheduled_at: "2026-10-02T14:30:00-03:00", status: "confirmed",
        confirmation_deadline_at: null, check_in_available: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    const scheduledAt = fmt("2026-10-02T14:30:00-03:00");
    expect(await screen.findByText(`Confirmado: ${scheduledAt} — UBS Centro`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cheguei na unidade" })).not.toBeInTheDocument();
  });

  it("4. com check_in_available, 'confirmed' também mostra 'Cheguei na unidade' e chama onCheckIn(appointmentId)", async () => {
    mockAppointments([{
      request: { id: "r6", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a3", scheduled_at: "2026-10-02T14:30:00-03:00", status: "confirmed",
        confirmation_deadline_at: null, check_in_available: true
      }
    }]);
    const onCheckIn = vi.fn();
    render(<AppointmentsSection citizenId="p1" onCheckIn={onCheckIn} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cheguei na unidade" }));
    expect(onCheckIn).toHaveBeenCalledWith("a3");
  });

  it("5. Cancelar abre o campo de motivo, desabilitado até 10 caracteres, e recarrega a lista ao cancelar", async () => {
    const appointments = mockAppointments([{
      request: { id: "r7", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a4", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    const cancelSpy = vi.spyOn(citizenApi, "cancelAppointment").mockResolvedValue({
      appointment: { id: "a4", scheduled_at: "x", status: "cancelled_by_citizen" }
    });
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    const field = await screen.findByLabelText("Motivo do cancelamento");
    // api#32: o aviso de texto congelado já está na tela antes de enviar.
    expect(field).toHaveAccessibleDescription(FROZEN_TEXT_NOTICE);
    const submit = screen.getByRole("button", { name: "Cancelar agendamento" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await userEvent.type(field, "não posso ir");
    expect(submit.disabled).toBe(false);

    await userEvent.click(submit);
    expect(cancelSpy).toHaveBeenCalledWith("a4", "não posso ir");
    expect(appointments).toHaveBeenCalledTimes(2);
  });

  it("5b. depois de cancelar com sucesso, o formulário fecha e não convive com o estado final", async () => {
    const scheduledItem: AppointmentItem = {
      request: { id: "r7b", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a4b", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    };
    const cancelledItem: AppointmentItem = {
      request: { id: "r7b", kind: "return", target_unit_name: "UBS Centro", status: "closed", closed_reason: "citizen_cancelled", reopened_reason: null },
      appointment: { id: "a4b", scheduled_at: "2026-10-02T14:30:00-03:00", status: "cancelled_by_citizen", confirmation_deadline_at: null, check_in_available: false }
    };
    vi.spyOn(citizenApi, "appointments")
      .mockResolvedValueOnce({ appointments: [scheduledItem] })
      .mockResolvedValueOnce({ appointments: [cancelledItem] });
    vi.spyOn(citizenApi, "cancelAppointment").mockResolvedValue({
      appointment: { id: "a4b", scheduled_at: "x", status: "cancelled_by_citizen" }
    });
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await userEvent.type(await screen.findByLabelText("Motivo do cancelamento"), "não posso ir");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar agendamento" }));

    expect(await screen.findByText("Cancelado por você")).toBeInTheDocument();
    expect(screen.queryByLabelText("Motivo do cancelamento")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).not.toBeInTheDocument();
  });

  it("6. Confirmar recarrega a lista", async () => {
    const appointments = mockAppointments([{
      request: { id: "r8", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a5", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    const confirmSpy = vi.spyOn(citizenApi, "confirmAppointment").mockResolvedValue({
      appointment: { id: "a5", scheduled_at: "x", status: "confirmed" }
    });
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect(confirmSpy).toHaveBeenCalledWith("a5");
    await vi.waitFor(() => expect(appointments).toHaveBeenCalledTimes(2));
  });

  it("6. confirmation_closed mostra 'O prazo para confirmar terminou'", async () => {
    mockAppointments([{
      request: { id: "r9", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a6", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    vi.spyOn(citizenApi, "confirmAppointment").mockRejectedValue(new ApiError(409, "confirmation_closed"));
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("O prazo para confirmar terminou")).toBeInTheDocument();
  });

  it("7. estados finais do horário", async () => {
    mockAppointments([
      {
        request: { id: "r10", kind: "return", target_unit_name: "UBS Centro", status: "closed", closed_reason: "citizen_cancelled", reopened_reason: null },
        appointment: { id: "a7", scheduled_at: "2026-10-02T14:30:00-03:00", status: "cancelled_by_citizen", confirmation_deadline_at: null, check_in_available: false }
      },
      {
        request: { id: "r11", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: "expired" },
        appointment: { id: "a8", scheduled_at: "2026-10-02T14:30:00-03:00", status: "expired", confirmation_deadline_at: null, check_in_available: false }
      },
      {
        request: { id: "r12", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: "no_show" },
        appointment: { id: "a9", scheduled_at: "2026-10-02T14:30:00-03:00", status: "no_show", confirmation_deadline_at: null, check_in_available: false }
      },
      {
        request: { id: "r13", kind: "return", target_unit_name: "UBS Centro", status: "closed", closed_reason: "fulfilled", reopened_reason: null },
        appointment: { id: "a10", scheduled_at: "2026-10-02T14:30:00-03:00", status: "checked_in", confirmation_deadline_at: null, check_in_available: false }
      }
    ]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Cancelado por você")).toBeInTheDocument();
    expect(await screen.findByText("Cancelado: sem confirmação no prazo — a unidade pode marcar outro horário")).toBeInTheDocument();
    expect(await screen.findByText("Você não compareceu — a unidade pode marcar outro horário")).toBeInTheDocument();
    expect(await screen.findByText("Atendido na UBS Centro")).toBeInTheDocument();
  });

  it("pedido encerrado pela unidade (dismissed), sem horário ativo, mostra um texto neutro", async () => {
    mockAppointments([{
      request: { id: "r14", kind: "return", target_unit_name: "UBS Centro", status: "closed", closed_reason: "dismissed", reopened_reason: null },
      appointment: null
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Pedido encerrado pela unidade")).toBeInTheDocument();
  });

  it("pedido reaberto e depois dispensado pela unidade: vale o encerramento, não o último horário expirado", async () => {
    mockAppointments([{
      request: { id: "r15", kind: "return", target_unit_name: "UBS Centro", status: "closed", closed_reason: "dismissed", reopened_reason: "expired" },
      appointment: { id: "a12", scheduled_at: "2026-10-02T14:30:00-03:00", status: "expired", confirmation_deadline_at: null, check_in_available: false }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Pedido encerrado pela unidade")).toBeInTheDocument();
    expect(screen.queryByText(/pode marcar outro horário/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("10. botões atendem os alvos de toque (>= 48px) e o texto (>= 18px)", async () => {
    mockAppointments([{
      request: { id: "r15", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a11", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
        confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    const confirmar = await screen.findByRole("button", { name: "Confirmar" });
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    for (const button of [confirmar, cancelar]) {
      expect(button).toHaveStyle({ minHeight: "56px", fontSize: "18px" });
    }
    const text = screen.getByText(/Agendado:/);
    expect(text).toHaveStyle({ fontSize: "18px" });
  });

  it("pedido movido de unidade (api#29): avisa que o local mudou e de onde veio", async () => {
    mockAppointments([{
      request: { id: "r9", kind: "return", target_unit_name: "UBS Destino", status: "scheduled", closed_reason: null,
                 reopened_reason: null, moved_from_unit_name: "UBS Fechando" },
      appointment: { id: "a9", scheduled_at: "2026-10-02T14:30:00-03:00", status: "scheduled",
                     confirmation_deadline_at: "2026-10-01T14:30:00-03:00", check_in_available: false }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Local alterado: este atendimento passou da UBS Fechando para a UBS Destino.")).toBeInTheDocument();
  });
});

// Módulo 17 (contrato §5): o horário diz tipo, profissional, unidade com
// endereço e fim; o pedido aberto pela triagem diz quem marca e o prazo.
describe("AppointmentsSection — módulo 17", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-10-06T10:00:00-03:00")));

  const START = "2026-10-08T09:00:00-03:00";
  const DEADLINE = "2026-10-07T09:00:00-03:00";

  it("horário com tipo, profissional, unidade com endereço e fim", async () => {
    mockAppointments([{
      request: { id: "r1", kind: "triage", target_unit_name: "UBS Batel", status: "scheduled", closed_reason: null,
                 reopened_reason: null, appointment_type_name: "Consulta médica", due_on: "2026-11-05" },
      appointment: {
        id: "a1", scheduled_at: START, ends_at: "2026-10-08T09:20:00-03:00", status: "scheduled",
        confirmation_deadline_at: DEADLINE, check_in_available: false,
        appointment_type_name: "Consulta médica", professional_name: "Ana Souza",
        unit: { name: "UBS Batel", address: { street: "Rua Padre Anchieta", number: "1500", complement: null, zip: "80730000" } },
        can_request_reschedule: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(`Agendado: ${fmt(START)} às 09:20 — UBS Batel. Confirme até ${fmt(DEADLINE)}`))
      .toBeInTheDocument();
    expect(screen.getByText("Consulta médica")).toBeInTheDocument();
    expect(screen.getByText("Com Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Rua Padre Anchieta, 1500 · CEP 80730-000")).toBeInTheDocument();
    // Pedido já com horário: o prazo previsto não aparece mais.
    expect(screen.queryByText(/Prazo previsto/)).not.toBeInTheDocument();
  });

  it("confirmado sem profissional nem endereço: só o que veio, sem 'null'", async () => {
    mockAppointments([{
      request: { id: "r2", kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
      appointment: {
        id: "a2", scheduled_at: START, ends_at: "2026-10-08T09:15:00-03:00", status: "confirmed",
        confirmation_deadline_at: null, check_in_available: false, appointment_type_name: "Retorno",
        professional_name: null, unit: { name: "UBS Centro", address: null }, can_request_reschedule: false
      }
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(`Confirmado: ${fmt(START)} às 09:15 — UBS Centro`)).toBeInTheDocument();
    expect(screen.getByText("Retorno")).toBeInTheDocument();
    expect(screen.queryByText(/^Com /)).not.toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
  });

  it("pedido da triagem com unidade: tipo, quem marca e prazo previsto", async () => {
    mockAppointments([{
      request: { id: "r3", kind: "triage", target_unit_name: "UBS Batel", status: "open", closed_reason: null,
                 reopened_reason: null, appointment_type_name: "Consulta médica", due_on: "2026-11-05" },
      appointment: null
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(
      "Pedido da triagem: Consulta médica — a UBS Batel vai entrar em contato para marcar o horário"
    )).toBeInTheDocument();
    expect(screen.getByText("Prazo previsto: até 05/11")).toBeInTheDocument();
  });

  it("pedido da triagem sem unidade (fila 'sem unidade'): a Secretaria indica, sem 'null'", async () => {
    mockAppointments([{
      request: { id: "r4", kind: "triage", target_unit_name: null, status: "open", closed_reason: null,
                 reopened_reason: null, appointment_type_name: "Consulta médica", due_on: "2026-10-31" },
      appointment: null
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(
      "Pedido da triagem: Consulta médica — a Secretaria de Saúde vai indicar a unidade e marcar o horário"
    )).toBeInTheDocument();
    expect(screen.getByText("Prazo previsto: até 31/10")).toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/)).not.toBeInTheDocument();
  });

  it("api anterior: pedido de retorno aberto sem prazo não mostra 'Prazo previsto'", async () => {
    mockAppointments([openReturn]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText("Retorno pedido na UBS Centro — a unidade vai marcar o horário")).toBeInTheDocument();
    expect(screen.queryByText(/Prazo previsto/)).not.toBeInTheDocument();
  });
});

// Módulo 17 (spec §6; ADR 0029): "Não posso nesse horário" devolve o pedido à
// fila com o mesmo prazo — não é o "Cancelar", que encerra o pedido.
describe("AppointmentsSection — 'Não posso nesse horário'", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-10-06T10:00:00-03:00")));

  const START = "2026-10-08T09:00:00-03:00";

  function item(over: Partial<NonNullable<AppointmentItem["appointment"]>> = {}): AppointmentItem {
    return {
      request: { id: "r30", kind: "triage", target_unit_name: "UBS Batel", status: "scheduled", closed_reason: null,
                 reopened_reason: null, appointment_type_name: "Consulta médica", due_on: "2026-11-05" },
      appointment: {
        id: "a30", scheduled_at: START, ends_at: "2026-10-08T09:20:00-03:00", status: "confirmed",
        confirmation_deadline_at: null, check_in_available: false, appointment_type_name: "Consulta médica",
        professional_name: "Ana Souza", unit: { name: "UBS Batel", address: null }, can_request_reschedule: true,
        ...over
      }
    };
  }

  it("aparece em 'confirmed' e em 'scheduled', ao lado do Cancelar", async () => {
    mockAppointments([ item(), { ...item({ id: "a31", status: "scheduled", confirmation_deadline_at: "2026-10-07T09:00:00-03:00" }),
      request: { ...item().request, id: "r31" } } ]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await screen.findByText(/Confirmado:/);
    expect(screen.getAllByRole("button", { name: "Não posso nesse horário" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(2);
  });

  it.each([
    [ "api anterior, sem o campo", { can_request_reschedule: undefined } ],
    [ "api diz que não pode", { can_request_reschedule: false } ]
  ])("ausente quando %s", async (_label, over) => {
    mockAppointments([ item(over) ]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await screen.findByText(/Confirmado:/);
    expect(screen.queryByRole("button", { name: "Não posso nesse horário" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("ausente quando o horário já começou, mesmo com can_request_reschedule de uma leitura antiga", async () => {
    vi.setSystemTime(new Date("2026-10-08T09:05:00-03:00"));
    mockAppointments([ item() ]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await screen.findByText(/Confirmado:/);
    expect(screen.queryByRole("button", { name: "Não posso nesse horário" })).not.toBeInTheDocument();
  });

  it("os dois formulários nunca aparecem juntos", async () => {
    mockAppointments([ item() ]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Não posso nesse horário" }));
    expect(screen.getByRole("button", { name: "Pedir outro horário" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Motivo do cancelamento")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Motivo do cancelamento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Não posso nesse horário" })).not.toBeInTheDocument();
  });

  it("pedido enviado: relê a lista e mostra que pediu outro horário, com o prazo mantido", async () => {
    const rescheduled = { appointment: { id: "a30", scheduled_at: START, status: "cancelled_by_citizen" as const } };
    const after: AppointmentItem = {
      request: { ...item().request, status: "open" },
      appointment: { ...item().appointment!, status: "cancelled_by_citizen", can_request_reschedule: false }
    };
    const list = vi.spyOn(citizenApi, "appointments")
      .mockResolvedValueOnce({ appointments: [ item() ] })
      .mockResolvedValueOnce({ appointments: [ after ] });
    const spy = vi.spyOn(citizenApi, "requestReschedule").mockResolvedValue(rescheduled);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Não posso nesse horário" }));
    await userEvent.click(screen.getByRole("radio", { name: "Trabalho" }));
    await userEvent.click(screen.getByRole("radio", { name: "Manhã" }));
    await userEvent.click(screen.getByRole("button", { name: "Pedir outro horário" }));

    expect(spy).toHaveBeenCalledWith("a30", { reasonCode: "work", preferredPeriod: "morning", note: "" });
    expect(await screen.findByText(RESCHEDULE_REQUESTED)).toBeInTheDocument();
    expect(RESCHEDULE_REQUESTED).toBe("Você pediu outro horário. A unidade vai marcar um novo.");
    expect(screen.getByText("Prazo previsto: até 05/11")).toBeInTheDocument();
    expect(screen.queryByText("Cancelado por você")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir outro horário" })).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
