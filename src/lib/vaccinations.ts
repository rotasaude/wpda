// Regras de tela de "Minhas vacinas" (módulo 29, ADR 0047). Puras: sem rede,
// sem estado. As frases são decisão do plano; nenhuma usa a palavra "atrasada".
import { ApiError, type CitizenUpcomingDose, type CitizenVaccineDose, type VaccineRnds } from "./citizenApi";
import { cityToday, fmtCalendarDate } from "./format";
import { messageFor } from "../modules/citizen/ui";

export const VACCINES_HELP =
  "Aqui aparecem as vacinas registradas nas salas de vacina da prefeitura e as que a equipe transcreveu da sua caderneta.";
export const VACCINES_RNDS_HELP =
  "“Enviada ao Ministério” quer dizer que a dose também aparece no Meu SUS Digital. “Em envio” quer dizer que ela ainda está a caminho.";
export const VACCINES_UNCHECKED =
  "Leve a caderneta de vacinação à sala de vacina da sua unidade de saúde. Depois que a equipe conferir, as próximas doses aparecem aqui.";
export const VACCINES_NOT_VERIFIED =
  "Para ver suas vacinas por aqui, valide seu cadastro na unidade de saúde com um documento com foto.";
export const VACCINES_DISABLED = "As vacinas ainda não aparecem por aqui nesta cidade.";
export const VACCINES_EMPTY = "Nenhuma vacina registrada por aqui ainda.";
export const UPCOMING_EMPTY = "Nenhuma dose prevista no calendário por enquanto.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NO_DATE = "A unidade informa a data";

export function doseTitle(d: { immunobiological_name: string; dose_name: string }): string {
  const parts = [ d.immunobiological_name, d.dose_name ].map(p => p.trim()).filter(Boolean);
  return parts.length ? parts.join(" — ") : "Vacina";
}

export function appliedText(d: CitizenVaccineDose): string | null {
  if (!ISO_DATE.test(d.applied_on)) return null;
  const base = `Aplicada em ${fmtCalendarDate(d.applied_on)}`;
  if (d.transcription) return `${base} — registrada a partir da caderneta`;
  return d.place_name ? `${base} — ${d.place_name}` : base;
}

export function rndsText(rnds: VaccineRnds | null): { label: string; tone: "ok" | "warn" } | null {
  if (rnds === "sent") return { label: "Enviada ao Ministério", tone: "ok" };
  if (rnds === "sending") return { label: "Em envio", tone: "warn" };
  return null;
}

export function upcomingText(u: CitizenUpcomingDose, today: string = cityToday()): string {
  if (!u.due_on || !ISO_DATE.test(u.due_on)) return NO_DATE;
  const date = fmtCalendarDate(u.due_on);
  return u.due_on <= today ? `Já pode tomar desde ${date}` : `A partir de ${date}`;
}

export function vaccinationsMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "feature_disabled") return VACCINES_DISABLED;
  return messageFor(error);
}
