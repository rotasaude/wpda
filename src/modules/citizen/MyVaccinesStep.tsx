// src/modules/citizen/MyVaccinesStep.tsx
// "Minhas vacinas" de uma pessoa do celular (módulo 29, ADR 0047). Só par
// validado. A tela desenha apenas o que as funções de lib/vaccinations devolvem:
// vacina, dose, data, local e situação do envio. Nunca lote, fabricante,
// vacinador, dose cancelada nem "atrasada". Próximas doses só com caderneta
// conferida.
import { useEffect, useState, type CSSProperties } from "react";
import { citizenApi, ApiError, type CitizenVaccinations } from "../../lib/citizenApi";
import { cityToday } from "../../lib/format";
import {
  UPCOMING_EMPTY, VACCINES_EMPTY, VACCINES_HELP, VACCINES_NOT_VERIFIED, VACCINES_RNDS_HELP, VACCINES_UNCHECKED,
  appliedText, doseTitle, rndsText, upcomingText, vaccinationsMessage
} from "../../lib/vaccinations";
import { BigButton, ErrorText, Screen } from "./ui";

export function MyVaccinesStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [data, setData] = useState<CitizenVaccinations | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não escreve.
    let alive = true;
    citizenApi.vaccinations(citizenId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === "not_verified") setNotVerified(true);
        else setError(vaccinationsMessage(e));
      });
    return () => { alive = false; };
  }, [citizenId]);

  const today = cityToday();

  return (
    <Screen title="Minhas vacinas" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      <p style={muted}>{VACCINES_HELP}</p>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !notVerified && !error && <p role="status">Carregando…</p>}
      {notVerified && (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="note" aria-label="cadastro não validado" style={warnNote}>{VACCINES_NOT_VERIFIED}</p>
          <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
        </div>
      )}
      {data && (
        <>
          <section aria-label="Próximas doses" style={{ display: "grid", gap: 12 }}>
            <h2 style={h2}>Próximas doses</h2>
            {data.checked ? (
              <>
                {data.upcoming.length === 0 && <p>{UPCOMING_EMPTY}</p>}
                <ul style={list}>
                  {data.upcoming.map((u, i) => (
                    <li key={i} aria-label={doseTitle(u)} style={card}>
                      <strong>{doseTitle(u)}</strong>
                      <div>{upcomingText(u, today)}</div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p role="note" aria-label="caderneta não conferida" style={warnNote}>{VACCINES_UNCHECKED}</p>
            )}
          </section>
          <section aria-label="Vacinas aplicadas" style={{ display: "grid", gap: 12 }}>
            <h2 style={h2}>Vacinas aplicadas</h2>
            {data.items.length === 0 && <p>{VACCINES_EMPTY}</p>}
            <ul style={list}>
              {data.items.map((d, i) => {
                const applied = appliedText(d);
                const rnds = rndsText(d.rnds);
                return (
                  <li key={i} aria-label={doseTitle(d)} style={card}>
                    <strong>{doseTitle(d)}</strong>
                    {applied && <div>{applied}</div>}
                    {rnds && (
                      <div>
                        <span style={{ ...pill, background: rnds.tone === "ok" ? "var(--ok-bg)" : "var(--warn-bg)" }}>{rnds.label}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {data.items.length > 0 && <p style={muted}>{VACCINES_RNDS_HELP}</p>}
          </section>
        </>
      )}
    </Screen>
  );
}

const warnNote: CSSProperties = { background: "var(--warn-bg)", padding: 12, borderRadius: 12, margin: 0 };
const card: CSSProperties = { border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 4 };
const pill: CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 8, fontWeight: 600 };
const muted: CSSProperties = { color: "var(--ink2)", margin: 0 };
const list: CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 };
const h2: CSSProperties = { fontSize: "1.1rem", margin: 0 };
