import { describe, expect, it } from "vitest";
import { filterNeighborhoods, formatAddress, formatZip, unitKindLabel } from "./territory";

const list = [
  { id: "n1", name: "Batel" },
  { id: "n2", name: "São Francisco" },
  { id: "n3", name: "Santa Felicidade" }
];

describe("filterNeighborhoods", () => {
  it("busca vazia devolve a lista inteira, na ordem da API", () => {
    expect(filterNeighborhoods(list, "")).toEqual(list);
    expect(filterNeighborhoods(list, "   ")).toEqual(list);
  });
  it("ignora acento e maiúsculas", () => {
    expect(filterNeighborhoods(list, "sao francisco").map(n => n.id)).toEqual([ "n2" ]);
    expect(filterNeighborhoods(list, "BATEL").map(n => n.id)).toEqual([ "n1" ]);
  });
  it("casa pedaço do nome", () => {
    expect(filterNeighborhoods(list, "fel").map(n => n.id)).toEqual([ "n3" ]);
  });
  it("sem resultado devolve lista vazia", () => {
    expect(filterNeighborhoods(list, "xyz")).toEqual([]);
  });
});

describe("formatZip", () => {
  it("8 dígitos viram 00000-000", () => expect(formatZip("80730000")).toBe("80730-000"));
  it("aceita já formatado", () => expect(formatZip("80730-000")).toBe("80730-000"));
  it.each([ null, undefined, "", "8073000", "807300001" ])("recusa %s", (zip) => expect(formatZip(zip)).toBeNull());
});

describe("formatAddress", () => {
  it("endereço completo", () => {
    expect(formatAddress({ street: "Rua Padre Anchieta", number: "1500", complement: "Térreo", zip: "80730000" }))
      .toBe("Rua Padre Anchieta, 1500 — Térreo · CEP 80730-000");
  });
  it("sem número nem complemento", () => {
    expect(formatAddress({ street: "Rua Padre Anchieta", number: null, complement: null, zip: "80730000" }))
      .toBe("Rua Padre Anchieta · CEP 80730-000");
  });
  it("sem CEP", () => {
    expect(formatAddress({ street: "Rua Padre Anchieta", number: "1500", complement: null, zip: null }))
      .toBe("Rua Padre Anchieta, 1500");
  });
  it("só CEP", () => {
    expect(formatAddress({ street: null, number: null, complement: null, zip: "80730000" })).toBe("CEP 80730-000");
  });
  it("número e complemento sem logradouro não dizem nada sozinhos", () => {
    expect(formatAddress({ street: null, number: "1500", complement: "Sala 2", zip: null })).toBeNull();
  });
  it("campos em branco contam como ausentes", () => {
    expect(formatAddress({ street: "  ", number: " ", complement: "", zip: "  " })).toBeNull();
  });
  it("CEP mal formado é omitido, o resto fica", () => {
    expect(formatAddress({ street: "Rua A", number: "1", complement: null, zip: "8073000" })).toBe("Rua A, 1");
  });
  it.each([ null, undefined ])("address %s vira null", (a) => expect(formatAddress(a)).toBeNull());
  it("nunca escreve undefined nem null, com qualquer combinação de campos ausentes", () => {
    const values = [ null, undefined, "", "x" ] as const;
    for (const street of values) for (const number of values) for (const complement of values) for (const zip of [ null, "80730000" ]) {
      const out = formatAddress({ street, number, complement, zip } as never) ?? "";
      expect(out).not.toMatch(/undefined|null/);
    }
  });
});

describe("unitKindLabel", () => {
  it.each([ [ "ubs", "UBS" ], [ "upa", "UPA" ], [ "hospital", "Hospital" ], [ "other", "Unidade de saúde" ] ])(
    "%s → %s", (kind, label) => expect(unitKindLabel(kind)).toBe(label));
  it("tipo desconhecido ou ausente não mostra rótulo", () => {
    expect(unitKindLabel("clinica_nova")).toBeNull();
    expect(unitKindLabel(null)).toBeNull();
    expect(unitKindLabel(undefined)).toBeNull();
  });
});
