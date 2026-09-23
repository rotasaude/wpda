import { useEffect, useState } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export function ConsentStep({ onAccept, onDecline }: { onAccept: (version: string) => void; onDecline: () => void }) {
  const [term, setTerm] = useState<{ version: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.consentTerm().then(setTerm).catch(e => setError(messageFor(e)));
  }, []);

  return (
    <Screen title="Antes de começar"
      footer={term && <>
        <BigButton onClick={() => onAccept(term.version)}>Concordo</BigButton>
        <BigButton variant="secondary" onClick={onDecline}>Não concordo</BigButton>
      </>}>
      {error && <ErrorText>{error}</ErrorText>}
      {!term && !error && <p>Carregando…</p>}
      {term && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{term.body}</div>}
    </Screen>
  );
}
