import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyTripsStep } from "./MyTripsStep";
import { citizenApi, ApiError, type CitizenTrips } from "../../lib/citizenApi";
import { TRIPS_DISABLED, TRIPS_EMPTY, TRIPS_NO_UPCOMING, TRIPS_NOT_VERIFIED } from "../../lib/trips";

beforeEach(() => { vi.useFakeTimers({ toFake: [ "Date" ] }); vi.setSystemTime(new Date("2026-11-03T10:00:00-03:00")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const DATA: CitizenTrips = {
  items: [
    { id: "t1", date: "2026-11-05", departure_at: "2026-11-05T05:30:00-03:00", boarding_label: "Praça da Matriz",
      destination_name: "Curitiba", provider_name: "Hospital Erasto Gaertner", status: "confirmed", companion: true },
    { id: "t0", date: "2026-10-20", departure_at: "2026-10-20T05:30:00-03:00", boarding_label: "Praça da Matriz",
      destination_name: "Ponta Grossa", provider_name: null, status: "done", companion: false }
  ],
  tfd: [ { id: "c1", status: "authorized", destination_name: "Curitiba", appointment_at: "2026-11-12T09:00:00-03:00",
    allowance_total_cents: 12345, paid: false } ]
};
const renderStep = (onValidate = vi.fn()) => render(<MyTripsStep citizenId="p1" onBack={vi.fn()} onValidate={onValidate} />);

describe("MyTripsStep", () => {
  it("próximas, anteriores e TFD, com uma leitura só", async () => {
    const spy = vi.spyOn(citizenApi, "trips").mockResolvedValue(DATA);
    renderStep();
    const next = within(await screen.findByRole("region", { name: "Próximas viagens" }));
    const t1 = next.getByRole("listitem", { name: "Viagem para Curitiba — 05/11/2026" });
    for (const text of [ "Saída: qui., 05/11, 05:30", "Embarque: Praça da Matriz", "Hospital Erasto Gaertner — Curitiba", "Confirmada", "Com acompanhante" ]) {
      expect(within(t1).getByText(text)).toBeInTheDocument();
    }
    const past = within(screen.getByRole("region", { name: "Viagens anteriores" }));
    expect(within(past.getByRole("listitem", { name: "Viagem para Ponta Grossa — 20/10/2026" })).getByText("Realizada")).toBeInTheDocument();
    const c1 = within(screen.getByRole("region", { name: "Tratamento Fora de Domicílio" })).getByRole("listitem", { name: "TFD para Curitiba" });
    expect(within(c1).getByText("Autorizado")).toBeInTheDocument();
    expect(within(c1).getByText("Atendimento no destino: qui., 12/11, 09:00")).toBeInTheDocument();
    expect(within(c1).getByText("Ajuda de custo: R$ 123,45 — a receber")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("p1");
  });

  it("nada clínico nem da escala na tela", async () => {
    const leaky = { ...DATA, items: [ { ...DATA.items[0], procedure: "Radioterapia", cid10: "C50", vehicle: { plate: "ABC1D23" },
      driver: { name: "João Motorista" } } ] };
    vi.spyOn(citizenApi, "trips").mockResolvedValue(leaky as unknown as CitizenTrips);
    renderStep();
    await screen.findByRole("listitem", { name: "Viagem para Curitiba — 05/11/2026" });
    expect(document.body.textContent).not.toMatch(/Radioterapia|C50|ABC1D23|João Motorista|placa|motorista|undefined|null|NaN/i);
  });

  it("sem TFD e sem anteriores: as seções não aparecem; sem viagens, o vazio", async () => {
    vi.spyOn(citizenApi, "trips").mockResolvedValue({ items: [], tfd: [] });
    renderStep();
    expect(await screen.findByText(TRIPS_EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Viagens anteriores" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Tratamento Fora de Domicílio" })).toBeNull();
  });

  it("só anteriores ou só TFD: \"Nenhuma viagem futura.\", sem lista vazia", async () => {
    vi.spyOn(citizenApi, "trips").mockResolvedValue({ items: [ DATA.items[1] ], tfd: [] });
    renderStep();
    const next = within(await screen.findByRole("region", { name: "Próximas viagens" }));
    expect(next.getByText(TRIPS_NO_UPCOMING)).toBeInTheDocument();
    expect(next.queryByText(TRIPS_EMPTY)).toBeNull();
    expect(next.queryByRole("list")).toBeNull();
    cleanup();
    vi.spyOn(citizenApi, "trips").mockResolvedValue({ items: [], tfd: DATA.tfd });
    renderStep();
    const next2 = within(await screen.findByRole("region", { name: "Próximas viagens" }));
    expect(next2.getByText(TRIPS_NO_UPCOMING)).toBeInTheDocument();
    expect(next2.queryByRole("list")).toBeNull();
  });

  it("par declarado (403 not_verified): só o convite", async () => {
    const onValidate = vi.fn();
    vi.spyOn(citizenApi, "trips").mockRejectedValue(new ApiError(403, "not_verified"));
    renderStep(onValidate);
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toHaveTextContent(TRIPS_NOT_VERIFIED);
    expect(screen.queryByRole("listitem")).toBeNull();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("interruptor caindo com a tela aberta", async () => {
    vi.spyOn(citizenApi, "trips").mockRejectedValue(new ApiError(403, "feature_disabled"));
    renderStep();
    expect(await screen.findByText(TRIPS_DISABLED)).toBeInTheDocument();
  });
});
