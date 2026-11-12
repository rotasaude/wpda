// Entrada da Ouvidoria na tela inicial (módulo 33, contrato §4). Com public_config recusado
// (403 feature_disabled, Q1) ou sem rede, a entrada só some: a tela em volta continua a mesma.
// Sem `onManifest` (desktop de produção, U2), só a denúncia anônima, se ligada.
import { useEffect, useId, useState } from "react";
import { BigButton } from "./ui";
import { citizenApi, type OmbudsmanPublicConfig } from "../../lib/citizenApi";

export function OmbudsmanEntry({ onManifest, onAnonymous }: { onManifest?: () => void; onAnonymous: () => void }) {
  const headingId = useId();
  const [ config, setConfig ] = useState<OmbudsmanPublicConfig | null>(null);
  useEffect(() => {
    let alive = true;
    citizenApi.ombudsmanPublicConfig().then(c => { if (alive) setConfig(c); }, () => { /* a entrada não aparece */ });
    return () => { alive = false; };
  }, []);

  if (!config || (!onManifest && !config.anonymous_web)) return null;
  return (
    <section aria-labelledby={headingId} style={{ display: "grid", gap: 12, margin: "24px 0" }}>
      <h2 id={headingId} style={{ fontSize: 20, margin: 0 }}>Ouvidoria</h2>
      <p style={{ margin: 0 }}>{onManifest
        ? "Reclamações, denúncias, elogios, sugestões e pedidos à Secretaria de Saúde."
        : "Denúncias à Secretaria de Saúde, sem se identificar. Reclamações, elogios, sugestões e pedidos são feitos pelo celular."}</p>
      {onManifest && <BigButton variant="secondary" onClick={onManifest}>Fazer uma manifestação</BigButton>}
      {config.anonymous_web && <BigButton variant="secondary" onClick={onAnonymous}>Denúncia anônima</BigButton>}
    </section>
  );
}
