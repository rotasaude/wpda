import { useState } from "react";
import { useCityIdentity } from "../../lib/useCityIdentity";

// Topo por cidade (decisão 6 do ciclo): brasão e "Prefeitura de <nome>" vindos
// do api (rotasaude/api#73); em falha/ausência, "Rota Saúde" com ícone neutro.
export function CityHeader() {
  const identity = useCityIdentity();
  const [ failedUrl, setFailedUrl ] = useState<string | null>(null);
  const url = identity?.coat_of_arms_url ?? null;
  const showCoat = url !== null && url !== failedUrl;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {showCoat
        ? <img src={url} alt={`Brasão de ${identity!.name}`} width={32} height={32} style={{ objectFit: "contain" }}
            onError={() => setFailedUrl(url)} />
        : (
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 6, display: "inline-flex", alignItems: "center",
            justifyContent: "center", background: "var(--accent-bg)", color: "var(--accent)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
            </svg>
          </span>
        )}
      <strong style={{ fontSize: 14, color: "var(--ink2)" }}>{identity ? `Prefeitura de ${identity.name}` : "Rota Saúde"}</strong>
    </div>
  );
}
