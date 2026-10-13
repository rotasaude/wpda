import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchReport, reportNote, type Report as ReportData } from "../lib/report";
import { fmtDateTime } from "../lib/format";
import { TONE_GLYPH, tierTone } from "../lib/tier";
import { CityHeader } from "./citizen/CityHeader";
import { EmergencyCall } from "./citizen/EmergencyCall";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: ReportData }
  | { kind: "invalid" }
  | { kind: "error" };

// signedIn: aberto na área logada (ResultStep). Lá não há link a proteger nem
// prazo a mostrar, e o relatório se alinha ao topo (WP-04, WP-17).
export function Report({ token, children, signedIn = false }: { token: string; children?: ReactNode; signedIn?: boolean }) {
  const [ state, setState ] = useState<State>({ kind: "loading" });
  // Com o relatório pronto, o foco vai ao título, como em toda troca de tela (WP-02).
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.kind !== "ok") return;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [ state.kind ]);

  useEffect(() => {
    let alive = true;
    fetchReport(token)
      .then(data => { if (alive) setState(data ? { kind: "ok", data } : { kind: "invalid" }); })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, [ token ]);

  if (state.kind === "loading") {
    return <Centered><p style={{ color: "var(--ink3)" }}>Carregando…</p><EmergencyCall /></Centered>;
  }
  if (state.kind === "invalid") {
    return <Centered><Message title="Link inválido" body="Este link é inválido ou expirou." /><EmergencyCall /></Centered>;
  }
  if (state.kind === "error") {
    return <Centered><Message title="Ops" body="Não foi possível carregar. Tente novamente." /><EmergencyCall /></Centered>;
  }

  const r = state.data;
  const note = reportNote(r.recommendation);
  return (
    <Centered top={signedIn}>
      <article style={{ maxWidth: 520, width: "100%" }}>
        <header style={{ marginBottom: 16 }}>
          <CityHeader />
          <h1 ref={heading} tabIndex={-1} style={{ fontSize: 24, margin: "8px 0 0" }}>Seu resultado</h1>
        </header>
        {r.tier && (() => {
          // Cor, forma (■ alto · ▲ moderado · ● baixo) e texto, em frase grande:
          // é a informação mais importante da tela (WP-04). A borda segura a forma
          // no alto contraste, onde o fundo some (WP-17). O número interno de
          // prioridade não aparece para o cidadão.
          const tone = tierTone(r.tier);
          const ink = tone ? `var(--${tone})` : "var(--accent)";
          return (
            <p data-glyph={tone ? TONE_GLYPH[tone] : undefined}
              style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, margin: "0 0 16px", padding: "8px 12px", borderRadius: 12,
                border: `2px solid ${ink}`, background: tone ? `var(--${tone}-bg)` : "var(--accent-bg)", color: ink }}>
              {`Seu resultado: prioridade ${r.tier}`}
            </p>
          );
        })()}
        {note.title && (
          <p style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, margin: "0 0 8px" }}>
            {note.title}
          </p>
        )}
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: "0 0 24px" }}>
          {note.body}
        </p>
        <footer style={{ fontSize: 12, color: "var(--ink3)", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {r.completed_at && <div>Realizado em {fmtDateTime(r.completed_at)}.</div>}
          {!signedIn && r.expires_at && <div>Válido até {fmtDateTime(r.expires_at)}.</div>}
          {!signedIn && <p style={{ marginTop: 12 }}>Estas informações são pessoais — não compartilhe este link.</p>}
        </footer>
        <EmergencyCall />
        {children && <div style={{ marginTop: 16 }}>{children}</div>}
      </article>
    </Centered>
  );
}

// O padding de baixo reserva o espaço da faixa fixa do 192.
function Centered({ children, top = false }: { children: ReactNode; top?: boolean }) {
  return (
    <main id="conteudo" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: top ? "flex-start" : "center", padding: 24, paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
      {children}
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 360 }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "var(--ink3)", fontSize: 14 }}>{body}</p>
    </div>
  );
}
