// "Emergência? Ligar 192" como faixa fixa no rodapé (WP-01): sempre à vista,
// sem rolar. Borda de 2 px: no alto contraste o fundo some e o 192 continua
// com forma de botão (WP-17).
export function EmergencyCall() {
  return (
    <div data-emergency-bar="" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 10,
      background: "var(--bg)", borderTop: "1px solid var(--rule)",
      padding: "8px 16px calc(8px + env(safe-area-inset-bottom))" }}>
      <a href="tel:192" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56,
        maxWidth: 520, margin: "0 auto", borderRadius: 12, background: "var(--down-bg)", color: "var(--down)",
        border: "2px solid var(--down)", fontSize: 18, fontWeight: 700, textDecoration: "underline" }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
        Emergência? Ligar 192
      </a>
    </div>
  );
}
