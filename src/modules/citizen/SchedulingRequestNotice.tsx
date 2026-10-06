// src/modules/citizen/SchedulingRequestNotice.tsx
// "Pedido de agendamento" no resultado da triagem (spec 2026-10-05 do módulo
// 17 §6; ADR 0029): quem marca é sempre a unidade; o cidadão nunca escolhe a
// vaga, só fica sabendo de quem vai ligar e do prazo previsto. null (só
// orientação, resultado urgente, api anterior) = bloco ausente. Pedido já
// marcado: diz o dia e a hora (fuso da cidade) e aponta "Seus agendamentos".
import type { SchedulingRequest } from "../../lib/citizenApi";
import { fmtDayMonth, fmtWeekdayDateTime } from "../../lib/format";

export function schedulingRequestText(r: SchedulingRequest): string {
  // Já marcado: nada de prazo (após uma junção o horário pode cair depois do
  // due_on) nem de "vai entrar em contato".
  if (r.status === "scheduled") {
    return r.scheduled_at
      ? `Sua consulta já está marcada: ${fmtWeekdayDateTime(r.scheduled_at)}. Veja os detalhes em "Seus agendamentos", em Minhas triagens.`
      : `Sua consulta já foi marcada. Veja o dia e a hora em "Seus agendamentos", em Minhas triagens.`;
  }
  const due = r.due_on ? ` Prazo previsto: até ${fmtDayMonth(r.due_on)}.` : "";
  return r.unit_name
    ? `A ${r.unit_name} vai entrar em contato para marcar sua consulta.${due}`
    : `A Secretaria de Saúde vai indicar a unidade, que vai entrar em contato para marcar sua consulta.${due}`;
}

export function SchedulingRequestNotice({ request }: { request: SchedulingRequest | null | undefined }) {
  if (!request) return null;
  return (
    <section aria-labelledby="scheduling-request-title"
      style={{ margin: "0 0 24px", padding: 12, borderRadius: 12, border: "1px solid var(--line, #eee)" }}>
      <h2 id="scheduling-request-title" style={{ fontSize: 20, margin: "0 0 8px" }}>Pedido de agendamento</h2>
      {request.appointment_type_name && (
        <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>{request.appointment_type_name}</p>
      )}
      <p style={{ fontSize: 18, margin: 0 }}>{schedulingRequestText(request)}</p>
      {request.status !== "scheduled" && (
        <p style={{ fontSize: 18, color: "var(--ink2, #555)", margin: "8px 0 0" }}>
          Quando a unidade marcar, o horário aparece em "Seus agendamentos", em Minhas triagens.
        </p>
      )}
    </section>
  );
}
