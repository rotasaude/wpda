// "Minhas manifestações" (módulo 33; contrato §3, §14): as manifestações de todas as pessoas do celular.
// Mostra só o que o cidadão pode ver: tipo, protocolo, recebimento, estado (`forwarded` = "Em análise", Q40), prazo,
// identidade preservada, CPF mascarado e "novo". Lê uma vez ao abrir; sem polling. A denúncia anônima nunca aparece.
import { useEffect, useState, type CSSProperties } from "react";
import { citizenApi, type CitizenManifestationSummary } from "../../lib/citizenApi";
import { fmtDate } from "../../lib/format";
import { deadlineText, kindLabel, ombudsmanMessage, stateLabel } from "../../lib/ombudsman";
import { BigButton, ErrorText, Screen } from "./ui";

export const ANONYMOUS_NOT_LISTED = "Denúncias anônimas não aparecem aqui, porque não ficam ligadas a ninguém.";
const EMPTY = "Você ainda não fez nenhuma manifestação por aqui.";

const isFinal = (state: string) => state === "answered" || state === "archived";

export function StatePill({ state }: { state: string }) {
  const tone: CSSProperties = isFinal(state) ? { border: "1px solid var(--rule2)" } : { background: "var(--accent-bg)" };
  return <span style={{ ...pill, ...tone }}>{stateLabel(state)}</span>;
}

function Item({ m, onOpen }: { m: CitizenManifestationSummary; onOpen: (id: string) => void }) {
  const kind = kindLabel(m.kind);
  const deadline = deadlineText(m); // a cor da lista (Q42)
  return (
    <li>
      <button type="button" aria-label={`${kind} — protocolo ${m.protocol}`} onClick={() => onOpen(m.id)} style={card}>
        <span style={row}>
          <strong>{kind}</strong>
          {m.has_unread && <span style={newStyle}>novo</span>}
        </span>
        <span style={block}>Protocolo {m.protocol}</span>
        <span style={block}>Recebida em {fmtDate(m.received_at)}</span>
        <span style={block}><StatePill state={m.state} /></span>
        {deadline && <span style={block}>{deadline}</span>}
        {m.identification_mode === "preserved" && <span style={block}>Identidade preservada</span>}
        {m.cpf_masked && <span style={block}>Para o CPF {m.cpf_masked}</span>}
      </button>
    </li>
  );
}

export function MyManifestationsStep({ onBack, onNew, onOpen, onAnonymous }: {
  onBack: () => void; onNew: () => void; onOpen: (id: string) => void; onAnonymous?: () => void;
}) {
  const [ items, setItems ] = useState<CitizenManifestationSummary[] | null>(null);
  const [ error, setError ] = useState<string | null>(null);

  useEffect(() => {
    // A resposta que chega depois do desmonte (ou da montagem desfeita do StrictMode) não escreve.
    let alive = true;
    citizenApi.manifestations().then(
      list => { if (alive) setItems(list); },
      e => { if (alive) setError(ombudsmanMessage(e)); }
    );
    return () => { alive = false; };
  }, []);

  return (
    <Screen title="Minhas manifestações"
      footer={<>
        <BigButton onClick={onNew}>Nova manifestação</BigButton>
        {onAnonymous && <BigButton variant="secondary" onClick={onAnonymous}>Denúncia anônima</BigButton>}
        <BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>
      </>}>
      {error && <ErrorText>{error}</ErrorText>}
      {!items && !error && <p role="status">Carregando…</p>}
      {items && items.length === 0 && <p>{EMPTY}</p>}
      {items && items.length > 0 && <ul style={list}>{items.map(m => <Item key={m.id} m={m} onOpen={onOpen} />)}</ul>}
      <p style={muted}>{ANONYMOUS_NOT_LISTED}</p>
    </Screen>
  );
}

const card: CSSProperties = { width: "100%", textAlign: "left", fontSize: 18, minHeight: 48, cursor: "pointer", background: "transparent",
  border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 4, color: "var(--ink)" };
const row: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const block: CSSProperties = { display: "block" };
const pill: CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 8, fontWeight: 600 };
const newStyle: CSSProperties = { padding: "0 8px", borderRadius: 999, fontSize: 18, fontWeight: 600,
  background: "var(--accent)", color: "var(--on-accent)" };
const muted: CSSProperties = { color: "var(--ink2)", margin: "16px 0 0" };
const list: CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 };
