// "Validar no posto" (spec 2026-09-24-citizen-presencial-verification §5): o
// código que o cidadão mostra ao atendente, com a contagem até vencer.
import { useCallback } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { CounterCodeStep } from "./CounterCodeStep";

export function VerificationCodeStep({ citizenId, onBack }: { citizenId: string; onBack: () => void }) {
  const issue = useCallback(() => citizenApi.issueVerificationCode(citizenId), [citizenId]);
  return (
    <CounterCodeStep title="Validar no posto"
      instruction="Mostre este código e um documento com foto ao atendente."
      issue={issue} onBack={onBack} />
  );
}
