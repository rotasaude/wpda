import { useEffect, useState, type ReactNode } from "react";
import { fetchReport, type Report as ReportData } from "../lib/report";
import { fmtDateTime } from "../lib/format";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: ReportData }
  | { kind: "invalid" }
  | { kind: "error" };

export function Report({ token }: { token: string }) {
  const [ state, setState ] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    fetchReport(token)
      .then(data => { if (alive) setState(data ? { kind: "ok", data } : { kind: "invalid" }); })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, [ token ]);

  if (state.kind === "loading") {
    return <Centered><p style={{ color: "var(--ink3, #888)" }}>Carregando…</p></Centered>;
  }
  if (state.kind === "invalid") {
    return <Centered><Message title="Link inválido" body="Este link é inválido ou expirou." /></Centered>;
  }
  if (state.kind === "error") {
    return <Centered><Message title="Ops" body="Não foi possível carregar. Tente novamente." /></Centered>;
  }

  const r = state.data;
  return (
    <Centered>
      <article style={{ maxWidth: 520, width: "100%" }}>
        <header style={{ marginBottom: 16 }}>
          <strong style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>Rota Saúde</strong>
          <h1 style={{ fontSize: 20, margin: "8px 0 0" }}>Seu resultado</h1>
        </header>
        <div style={{ marginBottom: 12 }}>
          {r.tier && (
            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999,
              background: "var(--accent-soft, #eef)", color: "var(--accent, #2b59ff)", fontSize: 12, marginRight: 8 }}>
              {r.tier}
            </span>
          )}
          {r.priority && <span style={{ fontSize: 12, color: "var(--ink2, #555)" }}>prioridade: {r.priority}</span>}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 24px" }}>
          Este é o resultado da sua triagem. Siga as orientações da sua unidade de saúde.
          Se os sintomas piorarem, procure atendimento.
        </p>
        <footer style={{ fontSize: 12, color: "var(--ink3, #888)", borderTop: "1px solid var(--line, #eee)", paddingTop: 12 }}>
          {r.completed_at && <div>Realizado em {fmtDateTime(r.completed_at)}.</div>}
          {r.expires_at && <div>Válido até {fmtDateTime(r.expires_at)}.</div>}
          <p style={{ marginTop: 12 }}>Estas informações são pessoais — não compartilhe este link.</p>
        </footer>
      </article>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "system-ui, sans-serif" }}>
      {children}
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 360 }}>
      <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "var(--ink3, #888)", fontSize: 14 }}>{body}</p>
    </div>
  );
}
