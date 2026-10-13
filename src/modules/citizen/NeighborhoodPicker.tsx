// Escolha do bairro (spec 2026-09-28 §6; ADR 0023): bairros ativos da cidade
// com busca, e "Prefiro não informar". Tocar num bairro já escolhe.
// Busca e "Prefiro não informar" vêm primeiro; cidade com muitos bairros só
// mostra a lista ao buscar ou a pedido (WP-14), sem 76 botões para rolar.
import { useState } from "react";
import type { Neighborhood } from "../../lib/citizenApi";
import { filterNeighborhoods } from "../../lib/territory";
import { BigButton, ErrorText, Field, Screen } from "./ui";

const SHOW_ALL_UP_TO = 8;

export function NeighborhoodPicker({ title, neighborhoods, notice, busy, onPick, onBack }:
  { title: string; neighborhoods: Neighborhood[]; notice?: string | null; busy?: boolean;
    onPick: (neighborhoodId: string | null) => void; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searching = query.trim() !== "";
  const few = neighborhoods.length <= SHOW_ALL_UP_TO;
  const listed = searching || showAll || few ? filterNeighborhoods(neighborhoods, query) : [];

  return (
    <Screen title={title} footer={<BigButton variant="secondary" disabled={busy} onClick={onBack}>Voltar</BigButton>}>
      <p>Usamos o bairro para indicar a unidade de saúde que atende você. Você pode trocar depois.</p>
      {notice && <ErrorText>{notice}</ErrorText>}
      <Field label="Buscar bairro" type="search" value={query} autoComplete="off" onChange={e => setQuery(e.target.value)} />
      <BigButton variant="secondary" disabled={busy} onClick={() => onPick(null)} style={{ marginBottom: 16 }}>
        Prefiro não informar
      </BigButton>
      {searching && listed.length === 0 &&
        <p role="status">Nenhum bairro encontrado com esse nome. Se preferir, toque em "Prefiro não informar".</p>}
      {!searching && !showAll && !few && <>
        <p>Digite o nome do bairro.</p>
        <BigButton variant="secondary" disabled={busy} onClick={() => setShowAll(true)}>
          Ver todos os bairros ({neighborhoods.length})
        </BigButton>
      </>}
      {listed.length > 0 && (
        <ul style={{ display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
          {listed.map(n => (
            <li key={n.id}>
              <BigButton variant="secondary" disabled={busy} onClick={() => onPick(n.id)}>{n.name}</BigButton>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
