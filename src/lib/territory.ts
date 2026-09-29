// Regras de tela do território (spec 2026-09-28 §6; ADR 0023), sem React.
import type { Neighborhood, UnitAddress } from "./citizenApi";

const KIND_LABEL: Record<string, string> = {
  ubs: "UBS",
  upa: "UPA",
  hospital: "Hospital",
  other: "Unidade de saúde"
};

export function unitKindLabel(kind: string | null | undefined): string | null {
  return kind ? (KIND_LABEL[kind] ?? null) : null;
}

// "São Francisco" e "sao francisco" são a mesma busca.
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function filterNeighborhoods(list: Neighborhood[], query: string): Neighborhood[] {
  const q = fold(query);
  if (q === "") return list;
  return list.filter(n => fold(n.name).includes(q));
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

export function formatZip(zip: string | null | undefined): string | null {
  const d = (zip ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : null;
}

// "Rua X, 123 — Sala 2 · CEP 80000-000". Número e complemento sem logradouro
// não dizem nada sozinhos e somem; nada ausente vira texto.
export function formatAddress(a: UnitAddress | null | undefined): string | null {
  if (!a) return null;
  const street = clean(a.street);
  const number = clean(a.number);
  const complement = clean(a.complement);
  const zip = formatZip(a.zip);

  let line: string | null = null;
  if (street) {
    line = number ? `${street}, ${number}` : street;
    if (complement) line = `${line} — ${complement}`;
  }
  const parts = [ line, zip ? `CEP ${zip}` : null ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
