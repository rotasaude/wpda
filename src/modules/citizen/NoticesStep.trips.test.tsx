// src/modules/citizen/NoticesStep.trips.test.tsx
// Hora e embarque do aviso são o retrato de quando ele foi enviado (api-surface §3):
// um "Viagem marcada" antigo segue mostrando a hora original depois de um "Horário mudou".
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoticesStep, tripNoticeTitle, TRIP_NOTICE_HINT, TRIP_NOTICE_CANCELLED_HINT } from "./NoticesStep";
import { citizenApi, type Notice, type TripNotice } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-03T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const changed: TripNotice = { kind: "trip", id: "n1", event: "departure_changed", date: "2026-11-05",
  departure_at: "2026-11-05T06:00:00-03:00", boarding_label: "Praça da Matriz", read: false, cpf_masked: null };

function setup(notices: Notice[]) {
  vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices, unread_count: notices.filter(n => !n.read).length });
  const markRead = vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
  render(<NoticesStep onBack={vi.fn()} onPreferences={vi.fn()} />);
  return { markRead };
}

describe("NoticesStep — aviso de viagem (módulo 30)", () => {
  it("item: título do evento e a saída; novo", async () => {
    setup([ changed ]);
    const item = await screen.findByRole("button", { name: /Horário da viagem mudou/ });
    expect(within(item).getByText("qui., 05/11, 06:00")).toBeInTheDocument();
    expect(within(item).getByText("novo")).toBeInTheDocument();
  });

  it("aviso de viagem: abre com data, hora e embarque, sem destino", async () => {
    const leaky = { ...changed, destination_name: "Curitiba", provider_name: "Hospital Erasto Gaertner" } as unknown as TripNotice;
    const { markRead } = setup([ leaky ]);
    await userEvent.click(await screen.findByRole("button", { name: /Horário da viagem mudou/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Horário da viagem mudou" })).toBeInTheDocument();
    expect(screen.getByText("Saída: qui., 05/11, 06:00")).toBeInTheDocument();
    expect(screen.getByText("Embarque: Praça da Matriz")).toBeInTheDocument();
    expect(screen.getByText(TRIP_NOTICE_HINT)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Curitiba|Hospital|undefined|null/);
    expect(markRead).toHaveBeenCalledWith("n1");
  });

  it("títulos por evento; desconhecido vira Aviso de viagem", () => {
    expect([ "added", "departure_changed", "boarding_changed", "cancelled", "removed", "reminder", "foo" ].map(tripNoticeTitle)).toEqual([
      "Viagem marcada", "Horário da viagem mudou", "Local de embarque mudou", "Viagem cancelada",
      "Você saiu da lista desta viagem", "Lembrete de viagem", "Aviso de viagem" ]);
  });

  it("cancelada ou retirada: a dica da central, sem hora; sem hora válida, só a data", async () => {
    setup([ { ...changed, id: "n4", event: "cancelled", departure_at: null } ]);
    await userEvent.click(await screen.findByRole("button", { name: /Viagem cancelada/ }));
    expect(await screen.findByText("Viagem de 05/11/2026")).toBeInTheDocument();
    expect(screen.getByText(TRIP_NOTICE_CANCELLED_HINT)).toBeInTheDocument();
    expect(TRIP_NOTICE_CANCELLED_HINT).toBe("Se ainda precisar ir, procure a central de transporte da Secretaria de Saúde.");
  });

  it("várias pessoas no telefone: o aviso diz de quem é", async () => {
    setup([ { ...changed, cpf_masked: "***.982.247-**" } ]);
    expect(within(await screen.findByRole("button", { name: /Horário da viagem mudou/ })).getByText("Para o CPF ***.982.247-**")).toBeInTheDocument();
  });
});
