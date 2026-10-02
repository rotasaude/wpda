import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingConfirmations } from "./PendingConfirmations";
import { citizenApi, type AppointmentItem, type Person } from "../../lib/citizenApi";

// Relógio fixo: os prazos das fixtures são absolutos.
beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-02T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const ana: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null };
const bia: Person = { id: "p2", cpf_masked: "***.444.777-**", verification_level: "declared", neighborhood: null };

function item(status: "scheduled" | "confirmed", deadline: string | null): AppointmentItem {
  return {
    request: { id: `r-${deadline}`, kind: "return", target_unit_name: "UBS Centro", status: "scheduled", closed_reason: null, reopened_reason: null },
    appointment: { id: `a-${deadline}`, scheduled_at: "2026-10-05T14:00:00-03:00", status, confirmation_deadline_at: deadline, check_in_available: false }
  };
}

describe("PendingConfirmations (api#39)", () => {
  it("mostra os horários a confirmar de cada pessoa e leva à pessoa ao tocar", async () => {
    vi.spyOn(citizenApi, "appointments").mockImplementation(async (id: string) => ({
      appointments: id === "p1"
        ? [ item("scheduled", "2026-10-04T14:00:00-03:00"), item("confirmed", null) ]
        : [ item("scheduled", "2026-10-03T09:00:00-03:00") ]
    }));
    const onOpen = vi.fn();
    render(<PendingConfirmations people={[ ana, bia ]} onOpen={onOpen} />);

    expect(await screen.findByText("Você tem 2 horários para confirmar")).toBeInTheDocument();
    const links = screen.getAllByRole("button");
    expect(links.map(b => b.textContent)).toEqual([
      "CPF ***.444.777-**: confirme até 03/10, 09:00",
      "CPF ***.982.247-**: confirme até 04/10, 14:00"
    ]);
    await userEvent.click(links[0]);
    expect(onOpen).toHaveBeenCalledWith("p2");
  });

  it("prazo vencido, horário confirmado ou erro de rede: nada aparece", async () => {
    vi.spyOn(citizenApi, "appointments").mockImplementation(async (id: string) => {
      if (id === "p2") throw new Error("offline");
      return { appointments: [ item("scheduled", "2026-10-02T09:00:00-03:00"), item("confirmed", null) ] };
    });
    const { container } = render(<PendingConfirmations people={[ ana, bia ]} onOpen={vi.fn()} />);
    await vi.waitFor(() => expect(citizenApi.appointments).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
