// Regras de tela de "Meu histórico" (módulo 20, F-20.4 e F-20.5; spec §4 e
// §8; contrato §2 e §4). Os textos das entradas vêm prontos do api; aqui só o
// rótulo do tipo, a junção das páginas, as linhas do resumo e o nome do PDF.
import type { CitizenDocumentRef, CitizenEntry, HealthVitals } from "./citizenApi";
import { fmtCalendarDate, fmtDate } from "./format";
import { EXAM_KIND, examFilename } from "./exams";

export const PARTIAL_NOTICE =
  "Este histórico mostra só o que passou pelo Rota Saúde. Consultas e exames registrados em outros sistemas da prefeitura não aparecem aqui.";
export const NOT_VERIFIED_INVITE =
  "Aqui aparecem só as suas triagens e os seus agendamentos. Para ver também o resumo de saúde, as consultas e os documentos, valide seu cadastro na unidade de saúde com um documento com foto.";
export const SUMMARY_EMPTY = {
  problems: "Nenhum problema de saúde ativo registrado.",
  medications: "Nenhum medicamento em uso registrado.",
  exam_requests: "Nenhum exame pedido nos últimos 12 meses.",
  vitals: "Nenhuma medida registrada."
};
export const DOCUMENT_GONE = "Este documento não está mais disponível. Ele pode ter sido cancelado.";

const KIND_LABEL: Record<string, string> = {
  triage: "Triagem",
  attendance: "Atendimento",
  screening: "Acolhimento",
  appointment: "Agendamento",
  consultation: "Consulta",
  clinical_document: "Documento",
  controlled_notification: "Receita de controle especial",
  campaign: "Campanha",
  // Módulo 21a (contrato §10).
  exam: "Exame"
};

// O cidadão não vê código de máquina: tipo novo do api vira "Registro".
export function citizenKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Registro";
}

// Situação das origens, em palavras do cidadão. Código novo do api (ou nulo,
// como em screening e consultation): não mostra.
const STATUS_LABEL: Record<string, string> = {
  completed: "concluído",
  aborted_by_revocation: "consentimento revogado",
  aborted_by_timeout: "interrompido",
  aborted_by_cancellation: "cancelado",
  waiting: "aguardando atendimento",
  in_care: "em atendimento",
  closed: "atendimento encerrado",
  scheduled: "marcado",
  confirmed: "confirmado",
  checked_in: "você compareceu",
  cancelled_by_citizen: "cancelado por você",
  expired: "não confirmado no prazo",
  no_show: "falta",
  finalized: "realizada",
  issued: "emitido",
  cancelled: "cancelado",
  read: "aviso lido",
  unread: "aviso não lido"
};

export function citizenStatusLabel(status: string | null): string | null {
  return status ? STATUS_LABEL[status] ?? null : null;
}

export function mergeEntries(current: CitizenEntry[], next: CitizenEntry[]): CitizenEntry[] {
  const seen = new Set(current.map((e) => e.id));
  return [ ...current, ...next.filter((e) => !seen.has(e.id)) ];
}

export function entryPlace(entry: CitizenEntry): string | null {
  const parts = [ entry.unit?.name, entry.professional_name ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function sinceText(since: string | null): string | null {
  const day = fmtCalendarDate(since);
  return day === "—" ? null : `desde ${day}`;
}

const GLUCOSE_MOMENT: Record<string, string> = { fasting: "em jejum", postprandial: "depois de comer", random: "a qualquer hora" };
const number = (n: number) => n.toLocaleString("pt-BR");

export function vitalsLines(v: HealthVitals): string[] {
  const out: string[] = [];
  if (v.blood_pressure) {
    out.push(`Pressão: ${v.blood_pressure.systolic}/${v.blood_pressure.diastolic} mmHg — ${fmtDate(v.blood_pressure.measured_at)}`);
  }
  if (v.weight_kg) out.push(`Peso: ${number(v.weight_kg.value)} kg — ${fmtDate(v.weight_kg.measured_at)}`);
  if (v.capillary_glucose) {
    const g = v.capillary_glucose;
    const moment = g.moment ? GLUCOSE_MOMENT[g.moment] : null;
    out.push(`Glicemia capilar: ${number(g.value)} mg/dL${moment ? ` (${moment})` : ""} — ${fmtDate(g.measured_at)}`);
  }
  return out;
}

// Só letras, números e hífen: nunca CPF, nome ou separador de caminho.
export function documentFilename(doc: CitizenDocumentRef): string {
  const raw = (doc.short_code ?? doc.id).replace(/[^A-Za-z0-9-]/g, "");
  return `documento-${raw || "pdf"}.pdf`;
}

// Situação da entrada: o rótulo pronto do api (exame, módulo 21a) vence a
// tradução do código da origem. Código desconhecido sem rótulo: nada.
export function entryStatusText(entry: CitizenEntry): string | null {
  return entry.status_label || citizenStatusLabel(entry.status);
}

// O PDF do exame tem nome próprio (o id é o do exame, sem código de conferência).
export function entryFilename(entry: CitizenEntry): string {
  if (entry.kind === EXAM_KIND && entry.document) return examFilename(entry.document.id);
  return entry.document ? documentFilename(entry.document) : "documento-pdf.pdf";
}
