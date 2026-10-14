import { describe, it, expect } from "vitest";
import { entryStatusText } from "./history";
import type { CitizenEntry } from "./citizenApi";

const exam = (over: Partial<CitizenEntry>): CitizenEntry =>
  ({ id: "e1", kind: "exam", occurred_at: "2026-10-05T07:30:00-03:00", title: "Hemograma completo", summary: null, status: null, document: null, ...over }) as CitizenEntry;

// A40: a situação do exame é só o rótulo do api; sem rótulo, nada (nunca o código traduzido de outra origem).
describe("entryStatusText do exame", () => {
  it("usa o status_label do api", () => {
    expect(entryStatusText(exam({ status: "scheduled", status_label: "Agendado" }))).toBe("Agendado");
  });
  it("sem status_label não mostra nada, mesmo com código conhecido de outra origem", () => {
    expect(entryStatusText(exam({ status: "cancelled" }))).toBeNull();
    expect(entryStatusText(exam({ status: "algo_novo" }))).toBeNull();
  });
});
