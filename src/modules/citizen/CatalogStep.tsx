// Catálogo de triagens de uma pessoa (spec 2026-10-05 §8.3 e §8.7; ADR 0027;
// contrato §3.4). Mostra só o que o api ofereceu, na ordem do api: a regra de
// oferta mora lá. Datas de calendário sem new Date (ver fmtCalendarDate).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, citizenApi, type Catalog } from "../../lib/citizenApi";
import { fmtCalendarDate } from "../../lib/format";
import { ReferenceUnits } from "../ReferenceUnits";
import { lastDoneText } from "../../lib/care";
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
    <li style={{ border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
      <strong style={{ fontSize: 18 }}>{title}</strong>
      {summary && <p style={{ margin: 0, fontSize: 18 }}>{summary}</p>}
      {lines.map(l => <p key={l} style={{ margin: 0, fontSize: 18, color: "var(--ink2)" }}>{l}</p>)}
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

  // O nome acessível diz qual triagem (WP-13); o texto visível fica curto.
  const startButton = (protocolName: string, title: string, label = "Começar") =>
    <BigButton disabled={busy} aria-label={`${label}: ${title}`} onClick={() => void start(protocolName)}>{label}</BigButton>;

  const c = catalog;
  const nothingToStart = c !== null && c.in_progress === null && c.suggested.length === 0 && c.available.length === 0;
  // Módulo 23 (F-23.8): oferta com o intervalo de repetição vencido vem antes,
  // com a última vez; o resto segue em "Disponíveis". Sem `overdue`, como hoje.
  // Sugerida e vencida passa para "refazer" e sai de "Sugeridas" (nunca duas
  // vezes; o api já separa as duas listas, e o filtro por protocol_name é defesa).
  const dueAll = c ? [ ...c.available, ...c.suggested ].filter(a => a.overdue === true) : [];
  const due = dueAll.filter((a, i) => dueAll.findIndex(b => b.protocol_name === a.protocol_name) === i);
  const dueNames = new Set(due.map(a => a.protocol_name));
  const suggestedRest = c ? c.suggested.filter(s => s.overdue !== true) : [];
  const rest = c ? c.available.filter(a => !dueNames.has(a.protocol_name)) : [];

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
          <Item title={c.in_progress.title} summary={null} action={startButton(c.in_progress.protocol_name, c.in_progress.title, "Continuar")} />
        </Section>
      )}
      {due.length > 0 && (
        <Section id="catalog-overdue" title="Está na hora de refazer">
          {due.map(a => {
            const last = lastDoneText(a);
            return <Item key={a.protocol_name} title={a.title} summary={a.summary} lines={last ? [ last ] : []}
              action={startButton(a.protocol_name, a.title)} />;
          })}
        </Section>
      )}
      {suggestedRest.length > 0 && (
        <Section id="catalog-suggested" title="Sugeridas para você">
          {suggestedRest.map(s => (
            <Item key={s.suggestion_id} title={s.title} summary={s.summary}
              lines={[ s.source_title
                ? `Sugerida pelo resultado da triagem ${s.source_title} de ${fmtCalendarDate(s.suggested_on)}`
                : `Sugerida pelo resultado de uma triagem de ${fmtCalendarDate(s.suggested_on)}` ]}
              action={startButton(s.protocol_name, s.title)} />
          ))}
        </Section>
      )}
      {rest.length > 0 && (
        <Section id="catalog-available" title="Disponíveis">
          {rest.map(a => (
            <Item key={a.protocol_name} title={a.title} summary={a.summary} action={startButton(a.protocol_name, a.title)} />
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
