// Topo por cidade (decisão 6 do ciclo): brasão e nome da prefeitura quando o
// api expuser (rotasaude/api#73); até lá, "Rota Saúde" com um ícone neutro.
export function CityHeader({ name, coatOfArmsUrl }: { name?: string; coatOfArmsUrl?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {coatOfArmsUrl
        ? <img src={coatOfArmsUrl} alt="" width={32} height={32} style={{ objectFit: "contain" }} />
        : (
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 6, display: "inline-flex", alignItems: "center",
            justifyContent: "center", background: "var(--accent-bg)", color: "var(--accent)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
            </svg>
          </span>
        )}
      <strong style={{ fontSize: 14, color: "var(--ink2)" }}>{name ?? "Rota Saúde"}</strong>
    </div>
  );
}
