// Regras de tela de "Meus exames" (módulo 21a, F-21.10; spec §6 "Cidadão";
// contrato §9). A política do laudo (immediate, after_acknowledgement,
// never_citizen) é aplicada no api: aqui só se traduz o `result` que ele
// devolveu. A tela nunca deduz o laudo da situação (`status_label`).
import type { CitizenExam, CitizenExamResult } from "./citizenApi";
import { fmtCalendarDate, fmtDate, fmtDateTime } from "./format";

// `kind` da entrada de exame na linha do tempo (contrato §10).
export const EXAM_KIND = "exam";

export const EXAMS_NOT_VERIFIED =
  "Para ver seus exames por aqui, valide seu cadastro na unidade de saúde com um documento com foto.";
export const EXAMS_DISABLED = "Os exames ainda não aparecem por aqui nesta cidade.";
export const EXAMS_EMPTY = "Nenhum exame pedido ainda.";
export const PICKUP_AT_UNIT = "Retire o resultado na sua unidade de saúde.";
export const EXAM_PDF_GONE = "Este resultado não está disponível por aqui. Procure a sua unidade de saúde.";

export type ExamResultView =
  | { kind: "none" }
  | { kind: "pickup"; text: string }
  | { kind: "available"; text: string; downloadable: boolean };

// "Retire na unidade" vence tudo (never_citizen); PDF só com available e
// pdf_available. Sem result, ou sem available, nada sobre o laudo.
export function examResultView(result: CitizenExamResult | null): ExamResultView {
  if (!result) return { kind: "none" };
  if (result.pickup_at_unit) return { kind: "pickup", text: PICKUP_AT_UNIT };
  if (!result.available) return { kind: "none" };
  const day = fmtCalendarDate(result.released_on);
  return {
    kind: "available",
    text: day === "—" ? "Resultado disponível" : `Resultado disponível — liberado em ${day}`,
    downloadable: result.pdf_available
  };
}

export function examScheduleText(exam: CitizenExam): string | null {
  if (!exam.scheduled_at) return null;
  const when = fmtDateTime(exam.scheduled_at);
  if (when === "—") return null;
  return exam.scheduled_place ? `Marcado para ${when} — ${exam.scheduled_place}` : `Marcado para ${when}`;
}

export function examRequestedText(exam: CitizenExam): string | null {
  const day = fmtDate(exam.requested_at);
  return day === "—" ? null : `Pedido em ${day}`;
}

export function mergeExams(current: CitizenExam[], next: CitizenExam[]): CitizenExam[] {
  const seen = new Set(current.map((x) => x.id));
  return [ ...current, ...next.filter((x) => !seen.has(x.id)) ];
}

// Só letras, números e hífen: nunca o nome do exame, CPF ou separador de caminho.
export function examFilename(examId: string): string {
  const raw = examId.replace(/[^A-Za-z0-9-]/g, "");
  return `exame-${raw || "resultado"}.pdf`;
}
