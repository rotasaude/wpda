// Catálogo de triagens de uma pessoa (spec 2026-10-05 §8.3 e §8.7; ADR 0027;
// contrato §3.4). Mostra só o que o api ofereceu, na ordem do api: a regra de
// oferta mora lá. Datas de calendário sem new Date (ver fmtCalendarDate).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, citizenApi, type Catalog } from "../../lib/citizenApi";
import { fmtCalendarDate } from "../../lib/format";
import { ReferenceUnits } from "../ReferenceUnits";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export const EMPTY_CATALOG_MESSAGE =
  "Não há triagens disponíveis para esta pessoa agora. Se precisar de atendimento, procure uma unidade de saúde.";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ marginBottom: 24 }}>
      <h2 id={id} style={{ fontSize: 20, margin: "0 0 8px" }}>{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>{children}</ul>
    </section>
  );
}

function Item({ title, summary, lines = [], action }:
  { title: string; summary: string | null; lines?: string[]; action?: ReactNode }) {
  return (
    <li style={{ border: "1px solid var(--rule2, #ccc)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
      <strong style={{ fontSize: 18 }}>{title}</strong>
      {summary && <p style={{ margin: 0, fontSize: 18 }}>{summary}</p>}
      {lines.map(l => <p key={l} style={{ margin: 0, fontSize: 18, color: "var(--ink2, #555)" }}>{l}</p>)}
      {action}
    </li>
  );
}

export function CatalogStep({ citizenId, notice, onStart, onProfileRequired, onProfile, onHistory, onBack }: {
  citizenId: string; notice?: string | null;
  onStart: (protocolName: string) => Promise<string | null>;
  onProfileRequired: () => void; onProfile: () => void; onHistory: () => void; onBack: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);
  // Guarda síncrona: setBusy só vale no próximo render, e dois toques cabem antes dele.
  const inFlight = useRef(false);
  const alive = useRef(true);
  // O callback muda a cada render do Flow; a ref evita reler o catálogo por isso.
  const profileRequired = useRef(onProfileRequired);
  profileRequired.current = onProfileRequired;

  function load() {
    citizenApi.catalog(citizenId)
      .then(c => { if (alive.current) { setCatalog(c); setError(null); } })
      .catch(e => {
        if (!alive.current) return;
        if (e instanceof ApiError && e.code === "profile_required") profileRequired.current();
        else setError(messageFor(e));
      });
  }

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [citizenId]);

  async function start(protocolName: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const refused = await onStart(protocolName);
      if (refused && alive.current) {
        setMessage(refused);
        load();
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const startButton = (protocolName: string, label = "Começar") =>
    <BigButton disabled={busy} onClick={() => void start(protocolName)}>{label}</BigButton>;

  const c = catalog;
  const nothingToStart = c !== null && c.in_progress === null && c.suggested.length === 0 && c.available.length === 0;

  return (
    <Screen title="Qual triagem fazer?" footer={<>
      <BigButton variant="secondary" disabled={busy} onClick={onProfile}>Meu perfil</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={onHistory}>Minhas triagens</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={onBack}>Voltar</BigButton>
    </>}>
      {message && <p role="status">{message}</p>}
      {error && <ErrorText>{error}</ErrorText>}
      {c === null && !error && <p>Carregando…</p>}
      {c?.in_progress && (
        <Section id="catalog-in-progress" title="Em andamento">
          <Item title={c.in_progress.title} summary={null} action={startButton(c.in_progress.protocol_name, "Continuar")} />
        </Section>
      )}
      {c && c.suggested.length > 0 && (
        <Section id="catalog-suggested" title="Sugeridas para você">
          {c.suggested.map(s => (
            <Item key={s.suggestion_id} title={s.title} summary={s.summary}
              lines={[ s.source_title
                ? `Sugerida pelo resultado da triagem ${s.source_title} de ${fmtCalendarDate(s.suggested_on)}`
                : `Sugerida pelo resultado de uma triagem de ${fmtCalendarDate(s.suggested_on)}` ]}
              action={startButton(s.protocol_name)} />
          ))}
        </Section>
      )}
      {c && c.available.length > 0 && (
        <Section id="catalog-available" title="Disponíveis">
          {c.available.map(a => (
            <Item key={a.protocol_name} title={a.title} summary={a.summary} action={startButton(a.protocol_name)} />
          ))}
        </Section>
      )}
      {c && nothingToStart && (
        <>
          <p>{EMPTY_CATALOG_MESSAGE}</p>
          <ReferenceUnits units={c.reference_units} />
        </>
      )}
      {c && c.recent.length > 0 && (
        <Section id="catalog-recent" title="Feitas recentemente">
          {c.recent.map(r => (
            <Item key={r.protocol_name} title={r.title} summary={r.summary}
              lines={[ `Feita em ${fmtCalendarDate(r.last_completed_on)}`,
                `Próxima a partir de ${fmtCalendarDate(r.next_available_on)}` ]} />
          ))}
        </Section>
      )}
    </Screen>
  );
}
