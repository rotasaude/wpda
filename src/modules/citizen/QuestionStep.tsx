// Uma pergunta por tela (spec §2.7). A chave de idempotência é uma por
// pergunta mostrada: um toque duplo manda a mesma chave e não avança duas vezes.
import { useMemo, useState } from "react";
import { citizenApi, type AnswerState, type Step } from "../../lib/citizenApi";
import { onlyDigits } from "../../lib/masks";
import { BigButton, ErrorText, Field, Screen, messageFor } from "./ui";

export function QuestionStep({ conversationId, step, onStep, onCompleted }: {
  conversationId: string; step: Step; onStep: (s: Step) => void; onCompleted: (triageId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => crypto.randomUUID(), [step.triage_id, step.step_id, step.index]);

  function handle(state: AnswerState) {
    setValue("");
    if (state.status === "in_progress" && "step" in state) onStep(state.step);
    else if ("triage_id" in state) onCompleted(state.triage_id);
  }

  async function send(answer: string) {
    setBusy(true);
    setError(null);
    try {
      handle(await citizenApi.answer(conversationId, answer, key));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    setBusy(true);
    setError(null);
    try {
      handle(await citizenApi.undo(conversationId));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const choice = step.answer_type === "boolean" || step.answer_type === "enum";

  return (
    <Screen title={step.prompt}
      footer={<>
        {!choice && <BigButton onClick={() => send(value)} disabled={busy || value.trim() === ""}>Continuar</BigButton>}
        {step.can_undo && <BigButton variant="secondary" onClick={back} disabled={busy}>Voltar</BigButton>}
      </>}>
      <p aria-live="polite" style={{ margin: "0 0 8px", color: "var(--ink2, #444)" }}>
        Pergunta {step.index} de {step.total}
      </p>
      <progress value={step.index} max={step.total} style={{ width: "100%", height: 8, marginBottom: 16 }} />
      {choice && (
        <div style={{ display: "grid", gap: 12 }}>
          {step.options.map(o => (
            <BigButton key={o.id} variant="secondary" disabled={busy} onClick={() => send(o.id)}>{o.title}</BigButton>
          ))}
        </div>
      )}
      {step.answer_type === "integer" && (
        <Field label={step.prompt} inputMode="numeric" value={value}
          onChange={e => setValue(onlyDigits(e.target.value).slice(0, 4))} />
      )}
      {step.answer_type === "text" && (
        <Field label={step.prompt} maxLength={500} value={value} onChange={e => setValue(e.target.value)} />
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}
