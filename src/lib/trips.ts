// Regras de tela de "Minhas viagens" (módulo 30): frases, tons e ordenação.
// Só o que a api entrega ao cidadão; nada clínico nem da escala da frota.
import { ApiError, type CitizenTfdCase, type CitizenTrip } from "./citizenApi";
import { fmtCalendarDate, fmtWeekdayDateTime } from "./format";
import { messageFor } from "../modules/citizen/ui";

export const TRIPS_HELP =
  "Aqui aparecem as viagens marcadas pela Secretaria de Saúde para o seu atendimento em outra cidade. Se algo mudar, você recebe um aviso.";
export const TRIPS_NOT_VERIFIED =
  "Para ver suas viagens por aqui, valide seu cadastro na unidade de saúde com um documento com foto.";
export const TRIPS_DISABLED = "As viagens ainda não aparecem por aqui nesta cidade.";
export const TRIPS_EMPTY = "Nenhuma viagem marcada por aqui.";
export const TFD_HELP =
  "O Tratamento Fora de Domicílio (TFD) paga a viagem e a ajuda de custo de quem precisa se tratar em outra cidade. A Secretaria informa quando e como receber.";

export type TripTone = "ok" | "warn" | "accent" | "neutral";

export function tripTitle(t: CitizenTrip): string {
  const dest = t.destination_name.trim();
  return dest ? `Viagem para ${dest}` : "Viagem";
}

export function tripLabel(t: CitizenTrip): string {
  return `${tripTitle(t)} — ${fmtCalendarDate(t.date)}`;
}

export function departureText(t: CitizenTrip): string {
  const when = t.departure_at ? fmtWeekdayDateTime(t.departure_at) : "—";
  return when === "—"
    ? `Saída em ${fmtCalendarDate(t.date)} — a Secretaria informa a hora`
    : `Saída: ${when}`;
}

export function boardingText(t: CitizenTrip): string {
  const label = t.boarding_label?.trim();
  return label ? `Embarque: ${label}` : "A Secretaria informa o local de embarque";
}

export function destinationText(t: CitizenTrip): string {
  const provider = t.provider_name?.trim();
  return provider ? `${provider} — ${t.destination_name}` : t.destination_name;
}

const TRIP_STATUS: Record<string, { label: string; tone: TripTone }> = {
  planned: { label: "Prevista — a Secretaria ainda confirma o veículo e o horário", tone: "warn" },
  confirmed: { label: "Confirmada", tone: "ok" },
  in_progress: { label: "Em viagem", tone: "accent" },
  done: { label: "Realizada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "neutral" }
};

export function tripStatusView(status: string): { label: string; tone: TripTone } {
  return Object.prototype.hasOwnProperty.call(TRIP_STATUS, status)
    ? TRIP_STATUS[status]
    : { label: "Em andamento", tone: "neutral" };
}

// Próximas: hoje em diante e ainda não realizadas (crescente). Anteriores: o resto (decrescente).
export function splitTrips(items: CitizenTrip[], today: string): { upcoming: CitizenTrip[]; past: CitizenTrip[] } {
  const key = (t: CitizenTrip) => `${t.date}|${t.departure_at ?? ""}`;
  const asc = (a: CitizenTrip, b: CitizenTrip) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  const isUpcoming = (t: CitizenTrip) => t.date >= today && t.status !== "done";
  return {
    upcoming: items.filter(isUpcoming).sort(asc),
    past: items.filter(t => !isUpcoming(t)).sort((a, b) => asc(b, a))
  };
}

export function moneyText(cents: number | null): string | null {
  if (cents === null) return null;
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TFD_STATUS: Record<string, { status: string; detail: string | null; tone: TripTone }> = {
  submitted: { status: "Em análise pela comissão de TFD", detail: "A comissão avalia o laudo do seu médico. A resposta chega por aqui.", tone: "warn" },
  returned: { status: "Em revisão pelo seu médico", detail: "A comissão pediu mais informações ao seu médico.", tone: "warn" },
  authorized: { status: "Autorizado", detail: "A Secretaria vai marcar a viagem. A data chega por aqui.", tone: "ok" },
  denied: { status: "Não autorizado", detail: "Procure a sua unidade de saúde para saber os próximos passos.", tone: "neutral" },
  scheduled: { status: "Viagem marcada", detail: null, tone: "ok" },
  travelling: { status: "Em viagem", detail: null, tone: "accent" },
  completed: { status: "Concluído", detail: null, tone: "neutral" },
  cancelled: { status: "Cancelado", detail: "Se ainda precisar, procure a sua unidade de saúde.", tone: "neutral" }
};

export function tfdView(c: CitizenTfdCase): { title: string; status: string; detail: string | null; tone: TripTone } {
  const dest = c.destination_name.trim();
  const title = dest ? `TFD para ${dest}` : "TFD";
  const known = Object.prototype.hasOwnProperty.call(TFD_STATUS, c.status) ? TFD_STATUS[c.status] : null;
  return { title, ...(known ?? { status: "Em andamento", detail: null, tone: "neutral" as TripTone }) };
}

export function appointmentText(c: CitizenTfdCase): string | null {
  if (!c.appointment_at) return null;
  const when = fmtWeekdayDateTime(c.appointment_at);
  return when === "—" ? null : `Atendimento no destino: ${when}`;
}

// Total 0 (api: paid=false) não vira "a receber": não há dinheiro a esperar.
export function allowanceText(c: CitizenTfdCase): string | null {
  if (c.allowance_total_cents === null || c.allowance_total_cents <= 0) return null;
  return `Ajuda de custo: ${moneyText(c.allowance_total_cents)} — ${c.paid ? "paga" : "a receber"}`;
}

export function tripsMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "feature_disabled") return TRIPS_DISABLED;
  return messageFor(error);
}
