import { describe, it, expect } from "vitest";
import { ApiError, type CitizenTfdCase, type CitizenTrip } from "./citizenApi";
import {
  TFD_HELP, TRIPS_DISABLED, TRIPS_EMPTY, TRIPS_HELP, TRIPS_NOT_VERIFIED, allowanceText, appointmentText, boardingText,
  departureText, destinationText, moneyText, splitTrips, tfdView, tripLabel, tripStatusView, tripTitle, tripsMessage
} from "./trips";

const trip = (over: Partial<CitizenTrip> = {}): CitizenTrip => ({
  id: "t1", date: "2026-11-05", departure_at: "2026-11-05T05:30:00-03:00", boarding_label: "Praça da Matriz",
  destination_name: "Curitiba", provider_name: "Hospital Erasto Gaertner", status: "confirmed", companion: false, ...over
});
const tfd = (over: Partial<CitizenTfdCase> = {}): CitizenTfdCase => ({
  id: "c1", status: "authorized", destination_name: "Curitiba", appointment_at: "2026-11-12T09:00:00-03:00",
  allowance_total_cents: 12345, paid: false, ...over
});

describe("trips", () => {
  it("textos fixos", () => {
    expect(TRIPS_NOT_VERIFIED).toBe(
      "Para ver suas viagens por aqui, valide seu cadastro na unidade de saúde com um documento com foto.");
    expect(TRIPS_DISABLED).toBe("As viagens ainda não aparecem por aqui nesta cidade.");
    expect(TRIPS_EMPTY).toBe("Nenhuma viagem marcada por aqui.");
    expect(TRIPS_HELP).toBe(
      "Aqui aparecem as viagens marcadas pela Secretaria de Saúde para o seu atendimento em outra cidade. Se algo mudar, você recebe um aviso.");
    expect(TFD_HELP).toBe(
      "O Tratamento Fora de Domicílio (TFD) paga a viagem e a ajuda de custo de quem precisa se tratar em outra cidade. A Secretaria informa quando e como receber.");
  });

  it("título, rótulo e destino", () => {
    expect(tripTitle(trip())).toBe("Viagem para Curitiba");
    expect(tripTitle(trip({ destination_name: " " }))).toBe("Viagem");
    expect(tripLabel(trip())).toBe("Viagem para Curitiba — 05/11/2026");
    expect(destinationText(trip())).toBe("Hospital Erasto Gaertner — Curitiba");
    expect(destinationText(trip({ provider_name: null }))).toBe("Curitiba");
  });

  it("departureText: hora válida, nula e inválida", () => {
    expect(departureText(trip())).toBe("Saída: qui., 05/11, 05:30");
    expect(departureText(trip({ departure_at: null }))).toBe("Saída em 05/11/2026 — a Secretaria informa a hora");
    expect(departureText(trip({ departure_at: "amanhã" }))).toBe("Saída em 05/11/2026 — a Secretaria informa a hora");
  });

  it("boardingText: com e sem local", () => {
    expect(boardingText(trip())).toBe("Embarque: Praça da Matriz");
    expect(boardingText(trip({ boarding_label: null }))).toBe("A Secretaria informa o local de embarque");
  });

  it("tripStatusView e tfdView: tabela e desconhecido", () => {
    expect(tripStatusView("planned")).toEqual({ label: "Prevista — a Secretaria ainda confirma o veículo e o horário", tone: "warn" });
    expect(tripStatusView("confirmed")).toEqual({ label: "Confirmada", tone: "ok" });
    expect(tripStatusView("in_progress")).toEqual({ label: "Em viagem", tone: "accent" });
    expect(tripStatusView("done")).toEqual({ label: "Realizada", tone: "neutral" });
    expect(tripStatusView("cancelled")).toEqual({ label: "Cancelada", tone: "neutral" });
    expect(tripStatusView("boarding")).toEqual({ label: "Em andamento", tone: "neutral" });
    expect(tfdView(tfd({ status: "submitted" }))).toEqual({ title: "TFD para Curitiba", status: "Em análise pela comissão de TFD",
      detail: "A comissão avalia o laudo do seu médico. A resposta chega por aqui.", tone: "warn" });
    expect(tfdView(tfd({ status: "returned" }))).toMatchObject({ status: "Em revisão pelo seu médico",
      detail: "A comissão pediu mais informações ao seu médico.", tone: "warn" });
    expect(tfdView(tfd({ status: "authorized" }))).toMatchObject({ status: "Autorizado",
      detail: "A Secretaria vai marcar a viagem. A data chega por aqui.", tone: "ok" });
    expect(tfdView(tfd({ status: "denied" }))).toMatchObject({ status: "Não autorizado",
      detail: "Procure a sua unidade de saúde para saber os próximos passos.", tone: "neutral" });
    expect(tfdView(tfd({ status: "scheduled" }))).toMatchObject({ status: "Viagem marcada", detail: null, tone: "ok" });
    expect(tfdView(tfd({ status: "travelling" }))).toMatchObject({ status: "Em viagem", detail: null, tone: "accent" });
    expect(tfdView(tfd({ status: "completed" }))).toMatchObject({ status: "Concluído", detail: null, tone: "neutral" });
    expect(tfdView(tfd({ status: "cancelled" }))).toMatchObject({ status: "Cancelado",
      detail: "Se ainda precisar, procure a sua unidade de saúde.", tone: "neutral" });
    expect(tfdView(tfd({ status: "foo" }))).toMatchObject({ status: "Em andamento", detail: null, tone: "neutral" });
    expect(tfdView(tfd({ destination_name: "" })).title).toBe("TFD");
  });

  it("splitTrips: hoje fica nas próximas até realizada", () => {
    const today = "2026-11-03";
    const a = trip({ id: "a", date: "2026-11-03", departure_at: "2026-11-03T05:00:00-03:00" });
    const b = trip({ id: "b", date: "2026-11-10" });
    const c = trip({ id: "c", date: "2026-11-03", status: "done" });
    const d = trip({ id: "d", date: "2026-10-20", status: "done" });
    const e = trip({ id: "e", date: "2026-11-06", status: "cancelled" });
    const { upcoming, past } = splitTrips([ b, d, a, c, e ], today);
    expect(upcoming.map(t => t.id)).toEqual([ "a", "e", "b" ]);
    expect(past.map(t => t.id)).toEqual([ "c", "d" ]);
  });

  it("allowanceText: nula, zero, alta, paga e a receber", () => {
    expect(moneyText(123456)).toBe("R$ 1.234,56");
    expect(moneyText(0)).toBe("R$ 0,00");
    expect(moneyText(null)).toBeNull();
    expect(allowanceText(tfd())).toBe("Ajuda de custo: R$ 123,45 — a receber");
    expect(allowanceText(tfd({ paid: true }))).toBe("Ajuda de custo: R$ 123,45 — paga");
    expect(allowanceText(tfd({ allowance_total_cents: null }))).toBeNull();
    expect(allowanceText(tfd({ allowance_total_cents: 0, paid: false }))).toBeNull();
  });

  it("appointmentText: com e sem horário", () => {
    expect(appointmentText(tfd())).toBe("Atendimento no destino: qui., 12/11, 09:00");
    expect(appointmentText(tfd({ appointment_at: null }))).toBeNull();
  });

  it("tripsMessage: interruptor desligado tem frase própria", () => {
    expect(tripsMessage(new ApiError(403, "feature_disabled"))).toBe(TRIPS_DISABLED);
  });
});
