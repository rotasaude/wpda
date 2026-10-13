// O relatório é gerado por um job depois de triage.completed: consulta a
// triagem até o link aparecer (spec §3.1) e então mostra o mesmo relatório do
// link público /r/:token.
import { useEffect, useState } from "react";
import { citizenApi, type ReferenceUnit, type SchedulingRequest, type TriageSuggestion } from "../../lib/citizenApi";
import { AlsoRecommended } from "./AlsoRecommended";
import { SchedulingRequestNotice } from "./SchedulingRequestNotice";
import { tokenFromUrl } from "../../lib/report";
import { Report } from "../Report";
import { ReferenceUnits } from "../ReferenceUnits";
import { BigButton, Screen } from "./ui";

const TRIES = 15;

export const HISTORY_LABEL = "Ver minhas triagens e horários";

// Na espera, só o indicador e o histórico: as ações e as sugestões esperam o
// resultado, que é o motivo de ter respondido (WP-03). "E agora?" diz o passo
// seguinte e, com check-in disponível, já oferece "Cheguei na unidade" (WP-05).
export function ResultStep({ triageId, onAgain, onHistory, onStartSuggestion, onCheckIn }: {
  triageId: string; onAgain: () => void; onHistory: () => void;
  onStartSuggestion: (protocolName: string) => Promise<string | null>;
  onCheckIn: (triageId: string) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  // Cada "Ver meu resultado de novo" é uma nova rodada de consultas.
  const [attempt, setAttempt] = useState(0);
  const [units, setUnits] = useState<ReferenceUnit[]>([]);
  const [suggestions, setSuggestions] = useState<TriageSuggestion[]>([]);
  const [scheduling, setScheduling] = useState<SchedulingRequest | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  // "Depois" mora aqui: o bloco muda de lugar quando o relatório fica pronto.
  const [later, setLater] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let alive = true;
    let tries = 0;
    async function poll() {
      tries += 1;
      try {
        const t = await citizenApi.triage(triageId);
        if (alive) {
          setUnits(t.reference_units ?? []);
          setSuggestions(t.suggestions ?? []);
          setScheduling(t.scheduling_request ?? null);
          setCheckIn(Boolean(t.check_in_available) && !t.attendance);
        }
        const found = t.report_url ? tokenFromUrl(new URL(t.report_url).search) : null;
        if (found) { if (alive) setToken(found); return; }
      } catch { /* tenta de novo */ }
      if (tries >= TRIES) { if (alive) setGaveUp(true); return; }
      if (alive) setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; };
  }, [triageId, attempt]);

  const history = <BigButton variant="secondary" onClick={onHistory}>{HISTORY_LABEL}</BigButton>;

  // Área logada: a unidade de referência vem sempre de GET /citizen/triages/:id.
  // O Report (link público) não a mostra.
  if (token) {
    return (
      <Report token={token} signedIn>
        <SchedulingRequestNotice request={scheduling} /><ReferenceUnits units={units} />
        <section aria-labelledby="next-steps" style={{ margin: "16px 0" }}>
          <h2 id="next-steps" style={{ fontSize: 20, margin: "0 0 8px" }}>E agora?</h2>
          <p>{checkIn
            ? "Se for à unidade de saúde, ao chegar toque em \"Cheguei na unidade\" e mostre o código na recepção."
            : `Seus horários marcados e as triagens anteriores ficam em "${HISTORY_LABEL}".`}</p>
          {checkIn && <BigButton onClick={() => onCheckIn(triageId)}>Cheguei na unidade</BigButton>}
        </section>
        <AlsoRecommended suggestions={suggestions} later={later}
          onLater={id => setLater(prev => new Set(prev).add(id))} onStart={onStartSuggestion} />
        <div style={{ display: "grid", gap: 12, padding: 0 }}>
          <BigButton variant={checkIn ? "secondary" : "primary"} onClick={onAgain}>Fazer outra triagem</BigButton>
          {history}
        </div>
      </Report>
    );
  }
  return (
    <Screen title="Seu resultado" footer={history}>
      <div role="status">
        <p>{gaveUp ? "Seu resultado ainda está sendo preparado." : "Preparando seu resultado…"}</p>
        {!gaveUp && <progress aria-label="Preparando seu resultado" style={{ width: "100%", height: 8, marginBottom: 16 }} />}
      </div>
      {gaveUp && <BigButton onClick={() => { setGaveUp(false); setAttempt(a => a + 1); }}>Ver meu resultado de novo</BigButton>}
      <SchedulingRequestNotice request={scheduling} />
      <ReferenceUnits units={units} />
    </Screen>
  );
}
