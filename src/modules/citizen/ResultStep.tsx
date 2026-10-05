// O relatório é gerado por um job depois de triage.completed: consulta a
// triagem até o link aparecer (spec §3.1) e então mostra o mesmo relatório do
// link público /r/:token.
import { useEffect, useState } from "react";
import { citizenApi, type ReferenceUnit, type TriageSuggestion } from "../../lib/citizenApi";
import { AlsoRecommended } from "./AlsoRecommended";
import { tokenFromUrl } from "../../lib/report";
import { Report } from "../Report";
import { ReferenceUnits } from "../ReferenceUnits";
import { BigButton, Screen } from "./ui";

const TRIES = 15;

export function ResultStep({ triageId, onAgain, onHistory, onStartSuggestion }: {
  triageId: string; onAgain: () => void; onHistory: () => void;
  onStartSuggestion: (protocolName: string) => Promise<string | null>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [units, setUnits] = useState<ReferenceUnit[]>([]);
  const [suggestions, setSuggestions] = useState<TriageSuggestion[]>([]);
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
        }
        const found = t.report_url ? tokenFromUrl(new URL(t.report_url).search) : null;
        if (found) { if (alive) setToken(found); return; }
      } catch { /* tenta de novo */ }
      if (tries >= TRIES) { if (alive) setGaveUp(true); return; }
      if (alive) setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; };
  }, [triageId]);

  const recommended = <AlsoRecommended suggestions={suggestions} later={later}
    onLater={id => setLater(prev => new Set(prev).add(id))} onStart={onStartSuggestion} />;
  const actions = (
    <div style={{ display: "grid", gap: 12, padding: 0 }}>
      <BigButton onClick={onAgain}>Fazer outra triagem</BigButton>
      <BigButton variant="secondary" onClick={onHistory}>Minhas triagens</BigButton>
    </div>
  );

  // Área logada: a unidade de referência vem sempre de GET /citizen/triages/:id.
  // O Report (link público) não a mostra.
  if (token) {
    return <Report token={token}><ReferenceUnits units={units} />{recommended}{actions}</Report>;
  }
  return (
    <Screen title="Triagem concluída" footer={actions}>
      <p>{gaveUp ? "Seu resultado ainda está sendo preparado. Veja em \"Minhas triagens\" daqui a pouco." : "Preparando seu resultado…"}</p>
      <ReferenceUnits units={units} />
      {recommended}
    </Screen>
  );
}
