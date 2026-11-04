// src/modules/citizen/MyTripsStep.tsx
// "Minhas viagens" de uma pessoa do celular (módulo 30). Só par validado.
// A tela desenha apenas o que as funções de lib/trips devolvem: data, hora,
// embarque, destino, situação e acompanhante. Nada clínico nem da escala da frota.
// Lê uma vez ao abrir; sem polling.
import { useEffect, useState, type CSSProperties } from "react";
import { citizenApi, ApiError, type CitizenTrip, type CitizenTrips } from "../../lib/citizenApi";
import { cityToday } from "../../lib/format";
import {
  TFD_HELP, TRIPS_EMPTY, TRIPS_HELP, TRIPS_NOT_VERIFIED,
  allowanceText, appointmentText, boardingText, departureText, destinationText,
  splitTrips, tfdView, tripLabel, tripStatusView, tripTitle, tripsMessage, type TripTone
} from "../../lib/trips";
import { BigButton, ErrorText, Screen } from "./ui";

const toneStyle = (tone: TripTone): CSSProperties =>
  tone === "ok" ? { background: "var(--ok-bg)" }
    : tone === "warn" ? { background: "var(--warn-bg)" }
      : tone === "accent" ? { background: "var(--accent-bg)" }
        : { border: "1px solid var(--rule2)" };

function Pill({ tone, children }: { tone: TripTone; children: string }) {
  return <span style={{ ...pill, ...toneStyle(tone) }}>{children}</span>;
}

function TripItem({ t }: { t: CitizenTrip }) {
  const status = tripStatusView(t.status);
  return (
    <li aria-label={tripLabel(t)} style={card}>
      <strong>{tripTitle(t)}</strong>
      <div>{departureText(t)}</div>
      <div>{boardingText(t)}</div>
      <div>{destinationText(t)}</div>
      <div><Pill tone={status.tone}>{status.label}</Pill></div>
      {t.companion && <div>Com acompanhante</div>}
    </li>
  );
}

export function MyTripsStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [data, setData] = useState<CitizenTrips | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não escreve.
    let alive = true;
    citizenApi.trips(citizenId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === "not_verified") setNotVerified(true);
        else setError(tripsMessage(e));
      });
    return () => { alive = false; };
  }, [citizenId]);

  const { upcoming, past } = data ? splitTrips(data.items, cityToday()) : { upcoming: [], past: [] };

  return (
    <Screen title="Minhas viagens" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      <p style={muted}>{TRIPS_HELP}</p>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !notVerified && !error && <p role="status">Carregando…</p>}
      {notVerified && (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="note" aria-label="cadastro não validado" style={warnNote}>{TRIPS_NOT_VERIFIED}</p>
          <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
        </div>
      )}
      {data && (
        <>
          <section aria-label="Próximas viagens" style={{ display: "grid", gap: 12 }}>
            <h2 style={h2}>Próximas viagens</h2>
            {upcoming.length === 0 && <p>{TRIPS_EMPTY}</p>}
            <ul style={list}>{upcoming.map((t) => <TripItem key={t.id} t={t} />)}</ul>
          </section>
          {data.tfd.length > 0 && (
            <section aria-label="Tratamento Fora de Domicílio" style={{ display: "grid", gap: 12 }}>
              <h2 style={h2}>Tratamento Fora de Domicílio</h2>
              <p style={muted}>{TFD_HELP}</p>
              <ul style={list}>
                {data.tfd.map((c) => {
                  const v = tfdView(c);
                  const appointment = appointmentText(c);
                  const allowance = allowanceText(c);
                  return (
                    <li key={c.id} aria-label={v.title} style={card}>
                      <strong>{v.title}</strong>
                      <div><Pill tone={v.tone}>{v.status}</Pill></div>
                      {v.detail && <div>{v.detail}</div>}
                      {appointment && <div>{appointment}</div>}
                      {allowance && <div>{allowance}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-label="Viagens anteriores" style={{ display: "grid", gap: 12 }}>
              <h2 style={h2}>Viagens anteriores</h2>
              <ul style={list}>{past.map((t) => <TripItem key={t.id} t={t} />)}</ul>
            </section>
          )}
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
