// Regras de tela de "Meus encaminhamentos" (módulo 26a; contrato §9). O api
// só devolve situação, data, local e rótulo: sem cor, prazo, fila, posição,
// CID ou justificativa. Situação desconhecida vira "Em andamento".
import { ApiError, type CitizenReferral } from "./citizenApi";
import { fmtDate, fmtWeekdayDateTime } from "./format";
import { messageFor } from "../modules/citizen/ui";

export const REFERRALS_NOT_VERIFIED =
  "Para ver seus encaminhamentos por aqui, valide seu cadastro na unidade de saúde com um documento com foto.";
export const REFERRALS_DISABLED = "Os encaminhamentos ainda não aparecem por aqui nesta cidade.";
export const REFERRALS_EMPTY = "Nenhum encaminhamento a especialista ou procedimento por aqui ainda.";
export const REFERRALS_HELP =
  "Aqui aparece a situação de cada encaminhamento. A data e o local chegam por aqui quando a vaga for marcada.";

export type ReferralTone = "warn" | "accent" | "ok" | "neutral";
export interface ReferralView { title: string; status: string; detail: string | null; tone: ReferralTone }

const SCHEDULE_UNKNOWN = "A unidade informa a data e o local.";

const TABLE: Record<string, { status: string; detail: string | null; tone: ReferralTone }> = {
  waiting: { status: "Aguardando a regulação",
    detail: "A Secretaria de Saúde está organizando a vaga. A data e o local chegam por aqui.", tone: "warn" },
  returned: { status: "Em revisão pela sua unidade", detail: "A sua unidade de saúde está completando o pedido.", tone: "warn" },
  denied: { status: "Não autorizado", detail: "Procure a sua unidade de saúde para saber os próximos passos.", tone: "neutral" },
  closed: { status: "Encerrado", detail: "Se ainda precisar, procure a sua unidade de saúde.", tone: "neutral" },
  completed: { status: "Realizado", detail: null, tone: "ok" }
};
const FALLBACK = { status: "Em andamento", detail: null, tone: "neutral" as ReferralTone };

function scheduledDetail(r: CitizenReferral): string {
  const when = fmtWeekdayDateTime(r.scheduled_at);
  if (when === "—") return SCHEDULE_UNKNOWN;
  const place = r.place?.trim();
  return place ? `${when} — ${place}` : `${when} — a unidade informa o local`;
}

export function referralView(r: CitizenReferral): ReferralView {
  const title = r.label.trim() || "Encaminhamento";
  if (r.status === "scheduled") return { title, status: "Agendado", detail: scheduledDetail(r), tone: "accent" };
  const row = Object.hasOwn(TABLE, r.status) ? TABLE[r.status] : FALLBACK;
  return { title, ...row };
}

export function updatedText(r: CitizenReferral): string | null {
  const day = fmtDate(r.updated_at);
  return day === "—" ? null : `Atualizado em ${day}`;
}

export function referralsMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "feature_disabled") return REFERRALS_DISABLED;
  return messageFor(error);
}
