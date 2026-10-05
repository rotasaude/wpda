// src/modules/citizen/AlsoRecommended.tsx
// "Recomendamos também" (spec 2026-10-05 §8.5; ADR 0027): sugestões nascidas
// desta triagem. Nunca começa sozinha. "Depois" só esconde aqui: a sugestão
// continua em "Sugeridas para você" no catálogo. Lista vazia (resultado
// urgente, nada sugerido, api anterior) = bloco ausente.
import { useRef, useState } from "react";
import type { TriageSuggestion } from "../../lib/citizenApi";
import { BigButton, ErrorText } from "./ui";

export const LATER_NOTE = "As sugestões ficam em \"Sugeridas para você\", na escolha da triagem.";

export function AlsoRecommended({ suggestions, later, onLater, onStart }: {
  suggestions: TriageSuggestion[]; later: ReadonlySet<string>; onLater: (suggestionId: string) => void;
  onStart: (protocolName: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guarda síncrona: setBusy só vale no próximo render.
  const inFlight = useRef(false);

  if (suggestions.length === 0) return null;
  const visible = suggestions.filter(s => !later.has(s.suggestion_id));
  if (visible.length === 0) return <p role="status" style={{ fontSize: 18, margin: "0 0 24px" }}>{LATER_NOTE}</p>;

  async function start(protocolName: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const refused = await onStart(protocolName);
      if (refused) setError(refused);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="also-recommended-title"
      style={{ margin: "0 0 24px", padding: 12, borderRadius: 12, border: "1px solid var(--line, #eee)" }}>
      <h2 id="also-recommended-title" style={{ fontSize: 20, margin: "0 0 8px" }}>Recomendamos também</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
        {visible.map(s => (
          <li key={s.suggestion_id} style={{ display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 18 }}>{s.title}</strong>
            {s.summary && <p style={{ margin: 0, fontSize: 18, color: "var(--ink2, #555)" }}>{s.summary}</p>}
            <BigButton disabled={busy} onClick={() => void start(s.protocol_name)}>Fazer agora</BigButton>
            <BigButton variant="secondary" disabled={busy} onClick={() => onLater(s.suggestion_id)}>Depois</BigButton>
          </li>
        ))}
      </ul>
      {error && <ErrorText>{error}</ErrorText>}
    </section>
  );
}
