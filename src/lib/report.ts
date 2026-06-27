// Relatório público do cidadão. Lê o token da URL e busca o JSON congelado
// de GET /r/:token (sem login). 404 = token inválido/expirado.
export interface TrailEntry { step: string; answer: string }

export interface Recommendation { title: string; body: string }

export interface Report {
  tier: string | null;
  priority: string | null;
  recommendation: Recommendation | null;
  summary: TrailEntry[] | null;
  completed_at: string | null;
  expires_at: string | null;
}

export const GENERIC_NOTE =
  "Este é o resultado da sua triagem. Siga as orientações da sua unidade de saúde. Se os sintomas piorarem, procure atendimento.";

export function reportNote(rec: Recommendation | null): { title: string | null; body: string } {
  if (rec && rec.title && rec.body) return { title: rec.title, body: rec.body };
  return { title: null, body: GENERIC_NOTE };
}

export function tokenFromUrl(search: string = window.location.search): string | null {
  const t = new URLSearchParams(search).get("token");
  return t && t.trim() !== "" ? t : null;
}

export async function fetchReport(token: string): Promise<Report | null> {
  const res = await fetch(`/r/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Report>;
}
