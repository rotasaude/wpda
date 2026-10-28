// src/modules/citizen/MyReferralsStep.tsx
// "Meus encaminhamentos" de uma pessoa do celular (módulo 26a, F-26.7; contrato
// §9). Só par validado: o par declarado vê o convite para validar e nenhum
// encaminhamento. A tela desenha apenas referralView(r) e updatedText(r):
// situação, data e local. Nunca cor de risco, prazo, posição na fila, CID ou
// justificativa.
import { useEffect, useState, type CSSProperties } from "react";
import { citizenApi, ApiError, type CitizenReferral } from "../../lib/citizenApi";
import {
  REFERRALS_EMPTY, REFERRALS_HELP, REFERRALS_NOT_VERIFIED, referralView, referralsMessage, updatedText,
  type ReferralTone
} from "../../lib/referrals";
import { BigButton, ErrorText, Screen } from "./ui";

export function MyReferralsStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [list, setList] = useState<CitizenReferral[] | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não escreve.
    let alive = true;
    citizenApi.regulationRequests(citizenId)
      .then((d) => { if (alive) setList(d ?? []); })
      .catch((e) => {
        if (!alive) return;
        // Par declarado: o api recusa com 403 not_verified; a tela mostra só o convite.
        if (e instanceof ApiError && e.code === "not_verified") setNotVerified(true);
        else setError(referralsMessage(e));
      });
    return () => { alive = false; };
  }, [citizenId]);

  return (
    <Screen title="Meus encaminhamentos" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      <p style={muted}>{REFERRALS_HELP}</p>
      {error && <ErrorText>{error}</ErrorText>}
      {!list && !notVerified && !error && <p role="status">Carregando…</p>}
      {notVerified && (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="note" aria-label="cadastro não validado" style={warnNote}>{REFERRALS_NOT_VERIFIED}</p>
          <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
        </div>
      )}
      {list && (
        <section aria-label="Encaminhamentos" style={{ display: "grid", gap: 12 }}>
          {list.length === 0 && <p>{REFERRALS_EMPTY}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {list.map((r) => <ReferralCard key={r.id} referral={r} />)}
          </ul>
        </section>
      )}
    </Screen>
  );
}

const TONE_BG: Record<ReferralTone, string | undefined> = {
  warn: "var(--warn-bg)", accent: "var(--accent-bg)", ok: "var(--ok-bg)", neutral: undefined
};

function ReferralCard({ referral }: { referral: CitizenReferral }) {
  const view = referralView(referral);
  const updated = updatedText(referral);
  return (
    <li aria-label={view.title} style={card}>
      <strong>{view.title}</strong>
      <div><span style={{ ...statusPill, background: TONE_BG[view.tone] }}>{view.status}</span></div>
      {view.detail && <div>{view.detail}</div>}
      {updated && <div style={muted}>{updated}</div>}
    </li>
  );
}

const warnNote: CSSProperties = { background: "var(--warn-bg)", padding: 12, borderRadius: 12, margin: 0 };
const card: CSSProperties = { border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 4 };
const statusPill: CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 8, fontWeight: 600 };
const muted: CSSProperties = { color: "var(--ink2)", margin: 0 };
