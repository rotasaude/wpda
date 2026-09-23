// O relatório é gerado por um job depois de triage.completed: consulta a
// triagem até o link aparecer (spec §3.1) e então mostra o mesmo relatório que
// o link do WhatsApp mostrava.
import { useEffect, useState } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { tokenFromUrl } from "../../lib/report";
import { Report } from "../Report";
import { BigButton, Screen } from "./ui";

const TRIES = 15;

export function ResultStep({ triageId, onAgain, onHistory }:
  { triageId: string; onAgain: () => void; onHistory: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    async function poll() {
      tries += 1;
      try {
        const t = await citizenApi.triage(triageId);
        const found = t.report_url ? tokenFromUrl(new URL(t.report_url).search) : null;
        if (found) { if (alive) setToken(found); return; }
      } catch { /* tenta de novo */ }
      if (tries >= TRIES) { if (alive) setGaveUp(true); return; }
      if (alive) setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; };
  }, [triageId]);

  const actions = (
    <div style={{ display: "grid", gap: 12, padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <BigButton onClick={onAgain}>Fazer outra triagem</BigButton>
      <BigButton variant="secondary" onClick={onHistory}>Minhas triagens</BigButton>
    </div>
  );

  if (token) return <><Report token={token} />{actions}</>;
  return (
    <Screen title="Triagem concluída" footer={actions}>
      <p>{gaveUp ? "Seu resultado ainda está sendo preparado. Veja em \"Minhas triagens\" daqui a pouco." : "Preparando seu resultado…"}</p>
    </Screen>
  );
}
