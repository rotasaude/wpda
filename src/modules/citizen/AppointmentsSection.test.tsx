import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentsSection } from "./AppointmentsSection";
import { citizenApi, ApiError, type AppointmentItem } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

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

  it("2. pedido reaberto por prazo ou falta acrescenta aviso de novo horário", async () => {
    mockAppointments([{
      request: { id: "r3", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: "expired" },
      appointment: null
    }]);
    render(<AppointmentsSection citizenId="p1" onCheckIn={vi.fn()} />);
    expect(await screen.findByText(
      "Retorno pedido na UBS Centro — a unidade vai marcar o horário A unidade pode marcar outro horário"
    )).toBeInTheDocument();
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
    const submit = screen.getByRole("button", { name: "Cancelar agendamento" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await userEvent.type(field, "não posso ir");
    expect(submit.disabled).toBe(false);

    await userEvent.click(submit);
    expect(cancelSpy).toHaveBeenCalledWith("a4", "não posso ir");
    expect(appointments).toHaveBeenCalledTimes(2);
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
});
