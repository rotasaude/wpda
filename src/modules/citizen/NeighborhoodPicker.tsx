// Escolha do bairro (spec 2026-09-28 §6; ADR 0023): bairros ativos da cidade
// com busca, e "Prefiro não informar". Tocar num bairro já escolhe.
import { useState } from "react";
import type { Neighborhood } from "../../lib/citizenApi";
import { filterNeighborhoods } from "../../lib/territory";
import { BigButton, ErrorText, Field, Screen } from "./ui";

export function NeighborhoodPicker({ title, neighborhoods, notice, busy, onPick, onBack }:
  { title: string; neighborhoods: Neighborhood[]; notice?: string | null; busy?: boolean;
    onPick: (neighborhoodId: string | null) => void; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const shown = filterNeighborhoods(neighborhoods, query);

  return (
    <Screen title={title} footer={<>
      <BigButton variant="secondary" disabled={busy} onClick={() => onPick(null)}>Prefiro não informar</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={onBack}>Voltar</BigButton>
    </>}>
      <p>Usamos o bairro para indicar a unidade de saúde que atende você. Você pode trocar depois.</p>
      {notice && <ErrorText>{notice}</ErrorText>}
      <Field label="Buscar bairro" value={query} autoComplete="off" onChange={e => setQuery(e.target.value)} />
      {shown.length === 0 && <p>Nenhum bairro encontrado com esse nome.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {shown.map(n => (
          <BigButton key={n.id} variant="secondary" disabled={busy} onClick={() => onPick(n.id)}>{n.name}</BigButton>
        ))}
      </div>
    </Screen>
  );
}
