import { tokenFromUrl } from "./lib/report";
import { Report } from "./modules/Report";

export function App() {
  const token = tokenFromUrl();
  if (!token) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <strong style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>Rota Saúde</strong>
          <h1 style={{ fontSize: 18, margin: "8px 0" }}>Link inválido</h1>
          <p style={{ color: "var(--ink3, #888)", fontSize: 14 }}>
            Use o link enviado por WhatsApp para ver seu resultado.
          </p>
        </div>
      </main>
    );
  }
  return <Report token={token} />;
}
