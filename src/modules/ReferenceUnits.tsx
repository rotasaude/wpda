// src/modules/ReferenceUnits.tsx
// Bloco "Sua unidade de referência" (spec 2026-09-28 §6; ADR 0023): as
// unidades ativas que atendem o bairro da triagem. Informa, nunca restringe.
// Só na área logada: o relatório público (/r/:token) não o mostra.
// Lista vazia (sem bairro, bairro sem cobertura ou api antiga) = sem bloco.
import type { ReferenceUnit } from "../lib/citizenApi";
import { formatAddress, unitKindLabel } from "../lib/territory";

export function ReferenceUnits({ units }: { units: ReferenceUnit[] | null | undefined }) {
  if (!units || units.length === 0) return null;
  const title = units.length === 1 ? "Sua unidade de referência" : "Suas unidades de referência";
  return (
    <section aria-label={title}
      style={{ margin: "0 0 24px", padding: 12, borderRadius: 12, border: "1px solid var(--line, #eee)" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {units.map(u => {
          const kind = unitKindLabel(u.kind);
          const address = formatAddress(u.address);
          return (
            <li key={u.id}>
              <strong>{u.name}</strong>
              {kind && <span style={{ marginLeft: 8, fontSize: 13, color: "var(--ink2, #555)" }}>{kind}</span>}
              {address && <div style={{ fontSize: 14, color: "var(--ink2, #555)" }}>{address}</div>}
            </li>
          );
        })}
      </ul>
      <p style={{ fontSize: 13, color: "var(--ink3, #888)", margin: "8px 0 0" }}>
        Atende o bairro informado. Você pode procurar qualquer unidade de saúde.
      </p>
    </section>
  );
}
