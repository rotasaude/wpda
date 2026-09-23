import { useEffect, useState } from "react";
import { citizenApi, type Person, type TriageSummary } from "../../lib/citizenApi";
import { fmtDateTime } from "../../lib/format";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export function HistoryStep({ citizenId, onBack }: { citizenId: string; onBack: () => void }) {
  const [data, setData] = useState<{ citizen: Person; triages: TriageSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    citizenApi.triages(citizenId).then(setData).catch(e => setError(messageFor(e)));
  }
  useEffect(load, [citizenId]);

  async function revoke(id: string) {
    if (!window.confirm("Revogar o consentimento apaga as respostas desta triagem. Continuar?")) return;
    try { await citizenApi.revokeConsent(id); load(); } catch (e) { setError(messageFor(e)); }
  }

  return (
    <Screen title="Minhas triagens" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      {error && <ErrorText>{error}</ErrorText>}
      {data && (
        <>
          <p>CPF {data.citizen.cpf_masked}</p>
          {data.citizen.verification_level === "declared" && (
            <p style={{ background: "var(--warnBg, #fff4e0)", padding: 12, borderRadius: 12 }}>
              Cadastro não verificado. Leve um documento com foto ao posto de saúde para ver seu histórico completo.
            </p>
          )}
          {data.triages.length === 0 && <p>Nenhuma triagem ainda.</p>}
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            {data.triages.map(t => (
              <li key={t.id} style={{ border: "1px solid var(--rule2, #ccc)", borderRadius: 12, padding: 12 }}>
                <strong>{t.tier ? `Prioridade ${t.tier}` : "Em andamento"}</strong>
                <div style={{ fontSize: 18 }}>{fmtDateTime(t.completed_at ?? t.created_at)}</div>
                {t.report_url && <a href={t.report_url} style={{ display: "inline-block", minHeight: 48, lineHeight: "48px", fontSize: 18 }}>Ver relatório</a>}
                {t.consent_active && (
                  <button type="button" onClick={() => revoke(t.id)}
                    style={{ minHeight: 48, background: "none", border: "none", textDecoration: "underline", fontSize: 18 }}>
                    Revogar consentimento
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
