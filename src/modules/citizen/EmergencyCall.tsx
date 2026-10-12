// "Em emergência, ligue 192" como link que liga (antes era só texto).
export function EmergencyCall() {
  return (
    <a href="tel:192" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48,
      marginTop: 12, borderRadius: 12, background: "var(--down-bg)", color: "var(--down)", fontSize: 16, fontWeight: 600,
      textDecoration: "none" }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
      </svg>
      Emergência? Ligar 192
    </a>
  );
}
