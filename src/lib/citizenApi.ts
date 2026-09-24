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
}

export interface StartResult { conversation_id: string; citizen_id: string; resumed: boolean; step: Step }

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
  triages: (citizenId: string) =>
    call<{ citizen: Person; triages: TriageSummary[] }>("GET", `/triages?citizen_id=${encodeURIComponent(citizenId)}`),
  triage: (id: string) => call<TriageSummary>("GET", `/triages/${id}`),
  revokeConsent: (id: string) => call<TriageSummary>("POST", `/triages/${id}/revoke_consent`),
  issueVerificationCode: (citizenId: string) =>
    call<{ code: string; expires_at: string }>("POST", "/verification_codes", { citizen_id: citizenId })
};
