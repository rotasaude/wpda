// Cliente das rotas /citizen/* (apps/api, CitizenApi). Mesma origem: o cookie
// httpOnly `citizen_session` vai sozinho. Toda escrita é JSON (a API recusa
// o resto com 415).
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export interface Option { id: string; title: string }

export interface Step {
  triage_id: string;
  step_id: string;
  prompt: string;
  answer_type: "boolean" | "enum" | "integer" | "text";
  options: Option[];
  index: number;
  total: number;
  can_undo: boolean;
}

export type AnswerState =
  | { status: "in_progress"; step: Step }
  | { status: string; triage_id: string };

export interface Person {
  id: string;
  cpf_masked: string;
  verification_level: "declared" | "verified";
  verified_at?: string | null;
}

export interface AttendanceSummary {
  status: "waiting" | "in_care" | "closed";
  unit_name: string;
  checked_in_at: string;
  outcome: "discharged" | "referred" | "left" | "return" | null;
  referral_unit_name: string | null;
  referral_note: string | null;
  closed_at: string | null;
  // Ausentes numa api anterior a este deploy: normalizados na borda (ver
  // normalizeTriage).
  called_at?: string | null;
  request_kind?: "return" | "referral" | null;
}

export interface TriageSummary {
  id: string;
  status: string;
  tier: string | null;
  priority: number | null;
  created_at: string;
  completed_at: string | null;
  report_url: string | null;
  consent_active: boolean;
  origin_phone_masked: string | null;
  // Ausentes numa api anterior a este deploy: normalizados na borda (ver
  // normalizeTriage) para que as telas nunca comparem `=== null` um valor
  // que pode chegar `undefined`.
  attendance?: AttendanceSummary | null;
  check_in_available?: boolean;
}

export interface StartResult { conversation_id: string; citizen_id: string; resumed: boolean; step: Step }

export interface AppointmentRequest {
  id: string;
  kind: "return" | "referral";
  target_unit_name: string;
  status: "open" | "scheduled" | "closed";
  // Ausentes numa api anterior a este deploy: normalizados na borda (ver
  // normalizeAppointment).
  closed_reason?: "fulfilled" | "citizen_cancelled" | "dismissed" | null;
  reopened_reason?: "expired" | "no_show" | null;
}

export interface Appointment {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "confirmed" | "checked_in" | "cancelled_by_citizen" | "expired" | "no_show";
  confirmation_deadline_at?: string | null;
  check_in_available?: boolean;
}

export interface AppointmentItem {
  request: AppointmentRequest;
  appointment: Appointment | null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const write = method !== "GET";
  const res = await fetch(`/citizen${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(write ? { "Content-Type": "application/json" } : {}) },
    body: write ? JSON.stringify(body ?? {}) : undefined
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("citizen:unauthenticated"));
    throw new ApiError(res.status, (data as { error?: string }).error ?? `http_${res.status}`);
  }
  return data as T;
}

function normalizeTriage(t: TriageSummary): TriageSummary {
  const a = t.attendance;
  return {
    ...t,
    attendance: a
      ? {
          ...a,
          // Api anterior a este deploy manda "open": mesmo estado, novo nome.
          status: (a.status as string) === "open" ? "waiting" : a.status,
          called_at: a.called_at ?? null,
          request_kind: a.request_kind ?? null
        }
      : (a ?? null),
    check_in_available: t.check_in_available ?? false
  };
}

function normalizeAppointment(item: AppointmentItem): AppointmentItem {
  return {
    request: {
      ...item.request,
      closed_reason: item.request.closed_reason ?? null,
      reopened_reason: item.request.reopened_reason ?? null
    },
    appointment: item.appointment
      ? {
          ...item.appointment,
          confirmation_deadline_at: item.appointment.confirmation_deadline_at ?? null,
          check_in_available: item.appointment.check_in_available ?? false
        }
      : null
  };
}

export const citizenApi = {
  requestCode: (phone: string) =>
    call<{ status: string; resend_after: number }>("POST", "/otp", { phone }),
  verifyCode: (phone: string, code: string) =>
    call<{ phone_masked: string }>("POST", "/session", { phone, code }),
  currentSession: () => call<{ phone_masked: string }>("GET", "/session"),
  signOut: () => call<void>("DELETE", "/session"),
  consentTerm: () => call<{ version: string; body: string }>("GET", "/consent_term"),
  people: () => call<{ people: Person[] }>("GET", "/people"),
  start: (p: { citizenId?: string; cpf?: string; consentVersion: string }) =>
    call<StartResult>("POST", "/conversations", {
      ...(p.citizenId ? { citizen_id: p.citizenId } : { cpf: p.cpf }),
      consent_version: p.consentVersion
    }),
  answer: (conversationId: string, answer: string, idempotencyKey: string) =>
    call<AnswerState>("POST", `/conversations/${conversationId}/answers`, { answer, idempotency_key: idempotencyKey }),
  undo: (conversationId: string) => call<AnswerState>("POST", `/conversations/${conversationId}/undo`),
  triages: async (citizenId: string) => {
    const data = await call<{ citizen: Person; triages: TriageSummary[] }>(
      "GET", `/triages?citizen_id=${encodeURIComponent(citizenId)}`);
    return { ...data, triages: data.triages.map(normalizeTriage) };
  },
  triage: async (id: string) => normalizeTriage(await call<TriageSummary>("GET", `/triages/${id}`)),
  revokeConsent: (id: string) => call<TriageSummary>("POST", `/triages/${id}/revoke_consent`),
  issueVerificationCode: (citizenId: string) =>
    call<{ code: string; expires_at: string }>("POST", "/verification_codes", { citizen_id: citizenId }),
  issueCheckInCode: (triageId: string) =>
    call<{ code: string; expires_at: string }>("POST", `/triages/${triageId}/check_in_code`),
  appointments: async (citizenId: string) => {
    const data = await call<{ appointments: AppointmentItem[] }>(
      "GET", `/appointments?citizen_id=${encodeURIComponent(citizenId)}`);
    return { appointments: data.appointments.map(normalizeAppointment) };
  },
  confirmAppointment: (id: string) => call<{ appointment: Appointment }>("POST", `/appointments/${id}/confirm`),
  cancelAppointment: (id: string, reason: string) =>
    call<{ appointment: Appointment }>("POST", `/appointments/${id}/cancel`, { reason }),
  issueAppointmentCheckInCode: (id: string) =>
    call<{ code: string; expires_at: string }>("POST", `/appointments/${id}/check_in_code`)
};
