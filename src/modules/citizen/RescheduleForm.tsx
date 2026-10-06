// src/modules/citizen/RescheduleForm.tsx
// "Não posso nesse horário" (spec 2026-10-05 do módulo 17 §6; ADR 0029):
// cancela este horário e devolve o pedido à unidade, com motivo (lista fixa),
// período preferido e uma nota opcional. Diferente do "Cancelar", que encerra
// o pedido. O prazo previsto não muda. Motivo, período e nota só vão no corpo
// do POST (citizenApi.requestReschedule): nada de <form>, URL ou console.
import { useRef, useState } from "react";
import { citizenApi, RESCHEDULE_NOTE_MAX, type PreferredPeriod, type RescheduleReasonCode } from "../../lib/citizenApi";
import { BigButton, ErrorText, FROZEN_TEXT_NOTICE, Field, RadioGroup, messageFor } from "./ui";

export const RESCHEDULE_INTRO =
  "Este horário será cancelado e o pedido volta para a unidade marcar outro. O prazo previsto continua o mesmo.";

const REASONS: readonly { value: RescheduleReasonCode; label: string }[] = [
  { value: "work", label: "Trabalho" },
  { value: "health", label: "Saúde" },
  { value: "transport", label: "Transporte" },
  { value: "other", label: "Outro motivo" }
];

const PERIODS: readonly { value: PreferredPeriod; label: string }[] = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "any", label: "Qualquer período" }
];

// Como o api conta: depois do trim, por ponto de código (um emoji = 1).
export function noteLength(note: string): number {
  return [ ...note.trim() ].length;
}

export function RescheduleForm({ appointmentId, onDone, onClose }:
  { appointmentId: string; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<RescheduleReasonCode | undefined>(undefined);
  const [period, setPeriod] = useState<PreferredPeriod | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: setBusy só vale no próximo render. Depois do sucesso fica
  // ligada: a lista é relida e este formulário some.
  const inFlight = useRef(false);

  const length = noteLength(note);
  const ready = reason !== undefined && period !== undefined && length <= RESCHEDULE_NOTE_MAX;

  async function submit() {
    if (!reason || !period || length > RESCHEDULE_NOTE_MAX || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await citizenApi.requestReschedule(appointmentId, { reasonCode: reason, preferredPeriod: period, note });
    } catch (e) {
      setError(messageFor(e));
      inFlight.current = false;
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <p style={{ fontSize: 18, margin: 0 }}>{RESCHEDULE_INTRO}</p>
      <RadioGroup legend="Por que não pode ir?" options={REASONS} value={reason} onChange={setReason} disabled={busy} />
      <RadioGroup legend="Qual período é melhor para você?" options={PERIODS} value={period} onChange={setPeriod}
        disabled={busy} />
      <Field label="Quer explicar? (opcional)" value={note} maxLength={RESCHEDULE_NOTE_MAX} autoComplete="off"
        onChange={e => setNote(e.target.value)} hint={FROZEN_TEXT_NOTICE} disabled={busy} />
      <p aria-live="polite"
        style={{ fontSize: 18, margin: 0,
          color: length > RESCHEDULE_NOTE_MAX ? "var(--down, #c0392b)" : "var(--ink2, #555)" }}>
        {`${length}/${RESCHEDULE_NOTE_MAX}`}
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <BigButton onClick={() => void submit()} disabled={busy || !ready}>Pedir outro horário</BigButton>
      <BigButton variant="secondary" onClick={onClose} disabled={busy}>Voltar</BigButton>
    </div>
  );
}
