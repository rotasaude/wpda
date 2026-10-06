// "Seus agendamentos" (spec 2026-09-25-citizen-appointments §6; módulo 17 §6):
// pedidos de retorno, encaminhamento e triagem, e os horários marcados pela
// unidade, acima de "Minhas triagens" em HistoryStep. Só aparece quando há
// algo a mostrar. Os campos do módulo 17 podem faltar (api anterior): a tela
// lê com ?? e nunca escreve null.
import { useEffect, useState } from "react";
import { citizenApi, type Appointment, type AppointmentItem, type AppointmentRequest } from "../../lib/citizenApi";
import { cityToday, fmtDayMonth, fmtHourMinute, fmtWeekdayDateTime } from "../../lib/format";
import { formatAddress } from "../../lib/territory";
import { RescheduleForm } from "./RescheduleForm";
import { BigButton, ErrorText, FROZEN_TEXT_NOTICE, Field, messageFor } from "./ui";

// "Não posso nesse horário" enviado: o horário vira cancelled_by_citizen e o
// pedido volta a "open" (o "Cancelar" o fecha como citizen_cancelled).
export const RESCHEDULE_REQUESTED = "Você pediu outro horário. A unidade vai marcar um novo.";

// Início e, quando o api manda (módulo 17), o fim: "qui., 08/10, 09:00 às 09:20".
function when(appointment: Appointment): string {
  return appointment.ends_at
    ? `${fmtWeekdayDateTime(appointment.scheduled_at)} às ${fmtHourMinute(appointment.ends_at)}`
    : fmtWeekdayDateTime(appointment.scheduled_at);
}

// O horário diz a própria unidade (módulo 17); numa api anterior, vale a do pedido.
function unitName(appointment: Appointment, request: AppointmentRequest): string {
  return appointment.unit?.name ?? request.target_unit_name ?? "unidade de saúde";
}

// Só pedido sem horário nenhum chega aqui: um pedido reaberto sempre traz o
// último horário (expired/no_show), que já diz "pode marcar outro horário".
function openRequestText(request: AppointmentRequest): string {
  if (request.kind === "triage") {
    const what = request.appointment_type_name ?? "Consulta";
    return request.target_unit_name
      ? `Pedido da triagem: ${what} — a ${request.target_unit_name} vai entrar em contato para marcar o horário`
      : `Pedido da triagem: ${what} — a Secretaria de Saúde vai indicar a unidade e marcar o horário`;
  }
  return request.kind === "return"
    ? `Retorno pedido na ${request.target_unit_name} — a unidade vai marcar o horário`
    : `Encaminhamento para ${request.target_unit_name} — a unidade vai marcar o horário`;
}

// O job de expiração roda a cada 15 min; até lá o horário ainda vem
// "scheduled", mas confirmar já seria recusado (confirmation_closed).
function confirmationClosed(appointment: Appointment): boolean {
  return !!appointment.confirmation_deadline_at && Date.now() >= new Date(appointment.confirmation_deadline_at).getTime();
}

// Quem decide é o api (can_request_reschedule, falso numa api anterior); o
// relógio só esconde o botão de uma leitura feita antes do início.
function canReschedule(appointment: Appointment): boolean {
  return appointment.can_request_reschedule === true && Date.now() < new Date(appointment.scheduled_at).getTime();
}

function finalStatusText(appointment: Appointment, request: AppointmentRequest, unit: string): string | null {
  switch (appointment.status) {
    case "cancelled_by_citizen": return request.status === "open" ? RESCHEDULE_REQUESTED : "Cancelado por você";
    case "expired": return "Cancelado: sem confirmação no prazo — a unidade pode marcar outro horário";
    case "no_show": return "Você não compareceu — a unidade pode marcar outro horário";
    case "checked_in": return `Atendido na ${unit}`;
    default: return null;
  }
}

// Tipo, profissional e endereço (módulo 17): uma linha por dado presente.
function AppointmentDetails({ appointment }: { appointment: Appointment }) {
  const lines = [
    appointment.appointment_type_name ?? null,
    appointment.professional_name ? `Com ${appointment.professional_name}` : null,
    formatAddress(appointment.unit?.address)
  ].filter((line): line is string => !!line);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map(line => (
        <p key={line} style={{ fontSize: 18, margin: "0 0 4px", color: "var(--ink2, #555)" }}>{line}</p>
      ))}
    </>
  );
}

function AppointmentRow({ item, onReload, onCheckIn }:
  { item: AppointmentItem; onReload: () => void; onCheckIn: (appointmentId: string) => void }) {
  const { request, appointment } = item;
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!appointment) return;
    setBusy(true);
    setError(null);
    try {
      await citizenApi.confirmAppointment(appointment.id);
      onReload();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!appointment) return;
    setBusy(true);
    setError(null);
    try {
      await citizenApi.cancelAppointment(appointment.id, reason);
      setCancelling(false);
      setReason("");
      onReload();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const final = appointment ? finalStatusText(appointment, request, unitName(appointment, request)) : null;
  const rescheduleButton = appointment && canReschedule(appointment) && (
    <BigButton variant="secondary" onClick={() => setRescheduling(true)} disabled={busy}>Não posso nesse horário</BigButton>
  );

  // A unidade só dispensa pedido aberto — e um pedido reaberto sempre traz o
  // último horário (expired/no_show). Dispensado vale mais que esse horário:
  // "pode marcar outro horário" deixou de ser verdade.
  if (request.status === "closed" && request.closed_reason === "dismissed") {
    return (
      <li style={{ border: "1px solid var(--rule2, #ccc)", borderRadius: 12, padding: 12 }}>
        <p style={{ fontSize: 18 }}>Pedido encerrado pela unidade</p>
      </li>
    );
  }

  return (
    <li style={{ border: "1px solid var(--rule2, #ccc)", borderRadius: 12, padding: 12 }}>
      {error && <ErrorText>{error}</ErrorText>}

      {request.moved_from_unit_name && (
        <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>
          {`Local alterado: este atendimento passou da ${request.moved_from_unit_name} para a ${request.target_unit_name}.`}
        </p>
      )}

      {!appointment && request.status === "open" && (
        <p style={{ fontSize: 18 }}>{openRequestText(request)}</p>
      )}

      {appointment && appointment.status === "scheduled" && (
        <>
          <p style={{ fontSize: 18 }}>
            Agendado: {when(appointment)} — {unitName(appointment, request)}.
            {appointment.confirmation_deadline_at && ` Confirme até ${fmtWeekdayDateTime(appointment.confirmation_deadline_at)}`}
          </p>
          <AppointmentDetails appointment={appointment} />
          {confirmationClosed(appointment) && (
            <p style={{ fontSize: 18 }}>O prazo para confirmar terminou. A unidade pode marcar outro horário.</p>
          )}
          {!cancelling && !rescheduling && (
            <div style={{ display: "grid", gap: 8 }}>
              {!confirmationClosed(appointment) && <BigButton onClick={confirm} disabled={busy}>Confirmar</BigButton>}
              {rescheduleButton}
              <BigButton variant="secondary" onClick={() => setCancelling(true)} disabled={busy}>Cancelar</BigButton>
            </div>
          )}
        </>
      )}

      {appointment && appointment.status === "confirmed" && (
        <>
          <p style={{ fontSize: 18 }}>
            Confirmado: {when(appointment)} — {unitName(appointment, request)}
          </p>
          <AppointmentDetails appointment={appointment} />
          {!cancelling && !rescheduling && (
            <div style={{ display: "grid", gap: 8 }}>
              {appointment.check_in_available && (
                <BigButton onClick={() => onCheckIn(appointment.id)}>Cheguei na unidade</BigButton>
              )}
              {rescheduleButton}
              <BigButton variant="secondary" onClick={() => setCancelling(true)} disabled={busy}>Cancelar</BigButton>
            </div>
          )}
        </>
      )}

      {cancelling && appointment && (appointment.status === "scheduled" || appointment.status === "confirmed") && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Field label="Motivo do cancelamento" value={reason} onChange={e => setReason(e.target.value)}
            hint={FROZEN_TEXT_NOTICE} />
          <BigButton variant="danger" onClick={cancel} disabled={busy || reason.trim().length < 10}>
            Cancelar agendamento
          </BigButton>
        </div>
      )}

      {rescheduling && appointment && (appointment.status === "scheduled" || appointment.status === "confirmed") && (
        <RescheduleForm appointmentId={appointment.id} onClose={() => setRescheduling(false)}
          onDone={() => { setRescheduling(false); onReload(); }} />
      )}

      {final && <p style={{ fontSize: 18 }}>{final}</p>}

      {/* Prazo já vencido some: o api preenche due_on = criação + 30 nos pedidos
          antigos, e um "até" passado (sem ano) seria lido como "perdi a vez".
          Comparação por texto AAAA-MM-DD, nunca por new Date. */}
      {request.status === "open" && request.due_on && request.due_on >= cityToday() && (
        <p style={{ fontSize: 18 }}>{`Prazo previsto: até ${fmtDayMonth(request.due_on)}`}</p>
      )}
    </li>
  );
}

export function AppointmentsSection({ citizenId, onCheckIn }:
  { citizenId: string; onCheckIn: (appointmentId: string) => void }) {
  const [items, setItems] = useState<AppointmentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    citizenApi.appointments(citizenId).then(d => setItems(d.appointments)).catch(e => setError(messageFor(e)));
  }
  useEffect(load, [citizenId]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!items || items.length === 0) return null;

  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20 }}>Seus agendamentos</h2>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {items.map(item => (
          <AppointmentRow key={item.request.id} item={item} onReload={load} onCheckIn={onCheckIn} />
        ))}
      </ul>
    </section>
  );
}
