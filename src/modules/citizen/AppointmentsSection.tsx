// "Seus agendamentos" (spec 2026-09-25-citizen-appointments §6): pedidos de
// retorno/encaminhamento e os horários marcados pela unidade, acima de
// "Minhas triagens" em HistoryStep. Só aparece quando há algo a mostrar.
import { useEffect, useState } from "react";
import { citizenApi, type Appointment, type AppointmentItem, type AppointmentRequest } from "../../lib/citizenApi";
import { BigButton, ErrorText, Field, messageFor } from "./ui";

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(iso));
}

function openRequestText(request: AppointmentRequest): string {
  const base = request.kind === "return"
    ? `Retorno pedido na ${request.target_unit_name} — a unidade vai marcar o horário`
    : `Encaminhamento para ${request.target_unit_name} — a unidade vai marcar o horário`;
  return request.reopened_reason ? `${base} A unidade pode marcar outro horário` : base;
}

function finalStatusText(appointment: Appointment, unitName: string): string | null {
  switch (appointment.status) {
    case "cancelled_by_citizen": return "Cancelado por você";
    case "expired": return "Cancelado: sem confirmação no prazo — a unidade pode marcar outro horário";
    case "no_show": return "Você não compareceu — a unidade pode marcar outro horário";
    case "checked_in": return `Atendido na ${unitName}`;
    default: return null;
  }
}

function AppointmentRow({ item, onReload, onCheckIn }:
  { item: AppointmentItem; onReload: () => void; onCheckIn: (appointmentId: string) => void }) {
  const { request, appointment } = item;
  const [cancelling, setCancelling] = useState(false);
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

  const final = appointment ? finalStatusText(appointment, request.target_unit_name) : null;

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

      {!appointment && request.status === "open" && (
        <p style={{ fontSize: 18 }}>{openRequestText(request)}</p>
      )}

      {appointment && appointment.status === "scheduled" && (
        <>
          <p style={{ fontSize: 18 }}>
            Agendado: {fmt(appointment.scheduled_at)} — {request.target_unit_name}.
            {appointment.confirmation_deadline_at && ` Confirme até ${fmt(appointment.confirmation_deadline_at)}`}
          </p>
          {!cancelling && (
            <div style={{ display: "grid", gap: 8 }}>
              <BigButton onClick={confirm} disabled={busy}>Confirmar</BigButton>
              <BigButton variant="secondary" onClick={() => setCancelling(true)} disabled={busy}>Cancelar</BigButton>
            </div>
          )}
        </>
      )}

      {appointment && appointment.status === "confirmed" && (
        <>
          <p style={{ fontSize: 18 }}>
            Confirmado: {fmt(appointment.scheduled_at)} — {request.target_unit_name}
          </p>
          {!cancelling && (
            <div style={{ display: "grid", gap: 8 }}>
              {appointment.check_in_available && (
                <BigButton onClick={() => onCheckIn(appointment.id)}>Cheguei na unidade</BigButton>
              )}
              <BigButton variant="secondary" onClick={() => setCancelling(true)} disabled={busy}>Cancelar</BigButton>
            </div>
          )}
        </>
      )}

      {cancelling && appointment && (appointment.status === "scheduled" || appointment.status === "confirmed") && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Field label="Motivo do cancelamento" value={reason} onChange={e => setReason(e.target.value)} />
          <BigButton variant="danger" onClick={cancel} disabled={busy || reason.trim().length < 10}>
            Cancelar agendamento
          </BigButton>
        </div>
      )}

      {final && <p style={{ fontSize: 18 }}>{final}</p>}
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
