// "Meu acompanhamento" (módulo 23, F-23.7 e F-23.8; spec §6 "Cidadão";
// contrato §7). Só par validado: o declarado vê o convite para validar. As
// linhas em que a pessoa foi inscrita e o que está para fazer, em linguagem
// simples — nunca código, sugestão, motivo de encerramento ou diagnóstico
// além do nome da linha (só os campos do contrato são desenhados). O aviso de
// triagem periódica vencida vem na mesma resposta (`overdue_triages`, L9).
// A tela depende do 403 `not_verified` do api para o par declarado.
import { useEffect, useState, type CSSProperties } from "react";
import { ApiError, citizenApi, type CitizenCare } from "../../lib/citizenApi";
import { CARE_EMPTY, CARE_NOT_VERIFIED, careItemView, careMessage, lastDoneText, type CareTone } from "../../lib/care";
import { BigButton, ErrorText, Screen } from "./ui";

const TONE_BG: Record<CareTone, string> = { ok: "var(--ok-bg)", warn: "var(--warn-bg)", neutral: "var(--sunken)" };

export function MyCareStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [ data, setData ] = useState<CitizenCare | null>(null);
  const [ notVerified, setNotVerified ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não escreve.
    let alive = true;
    citizenApi.care(citizenId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === "not_verified") setNotVerified(true);
        else setError(careMessage(e));
      });
    return () => { alive = false; };
  }, [ citizenId ]);

  return (
    <Screen title="Meu acompanhamento" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && !notVerified && <p role="status">Carregando…</p>}
      {notVerified && (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="note" aria-label="cadastro não validado" style={warnNote}>{CARE_NOT_VERIFIED}</p>
          <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
        </div>
      )}
      {data && !notVerified && (
        <div style={{ display: "grid", gap: 24 }}>
          {data.overdue_triages.length > 0 && (
            <section aria-labelledby="care-screenings">
              <h2 id="care-screenings" style={h2}>Triagens para refazer</h2>
              <ul style={listStyle}>
                {data.overdue_triages.map((e) => {
                  const last = lastDoneText(e);
                  return (
                    <li key={e.protocol_name} aria-label={e.title || "Triagem"} style={{ ...card, background: TONE_BG.warn }}>
                      <strong>{e.title || "Triagem"}</strong>
                      <div>Está na hora de refazer esta triagem.</div>
                      {last && <div style={muted}>{last}</div>}
                    </li>
                  );
                })}
              </ul>
              <p style={muted}>Para refazer, volte até “Para quem é esta triagem?” e escolha esta pessoa: abre a tela “Qual triagem fazer?”.</p>
            </section>
          )}
          {data.lines.length === 0 && <p>{CARE_EMPTY}</p>}
          {data.lines.map((line, i) => (
            <section key={`${line.name}-${i}`} aria-labelledby={`care-line-${i}`}>
              <h2 id={`care-line-${i}`} style={h2}>{line.name || "Acompanhamento"}</h2>
              <ul style={listStyle}>
                {line.items.map((item, j) => {
                  const view = careItemView(item);
                  return (
                    <li key={`${view.title}-${j}`} aria-label={view.title} style={{ ...card, background: TONE_BG[view.tone] }}>
                      <strong>{view.title}</strong>
                      {view.status && <div>{view.status}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}

const h2: CSSProperties = { fontSize: 20, margin: "0 0 8px" };
const listStyle: CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 };
const card: CSSProperties = { border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 4 };
const muted: CSSProperties = { color: "var(--ink2)", margin: 0 };
const warnNote: CSSProperties = { background: "var(--warn-bg)", padding: 12, borderRadius: 12, margin: 0 };
