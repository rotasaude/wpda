import { describe, it, expect } from "vitest";
import type { CitizenExam } from "./citizenApi";
import {
  PICKUP_AT_UNIT, examFilename, examRequestedText, examResultView, examScheduleText, mergeExams
} from "./exams";

const exam = (over: Partial<CitizenExam> = {}): CitizenExam => ({
  id: "ex1", label: "Hemograma completo", status_label: "Pedido", requested_at: "2026-10-01T09:00:00-03:00",
  scheduled_at: null, scheduled_place: null, result: null, ...over
});

describe("examResultView: tabela das políticas", () => {
  const cases: [ string, CitizenExam["result"], ReturnType<typeof examResultView> ][] = [
    [ "sem resultado (ou after_acknowledgement antes da ciência)", null, { kind: "none" } ],
    [ "immediate com PDF", { available: true, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: true },
      { kind: "available", text: "Resultado disponível — liberado em 08/10/2026", downloadable: true } ],
    [ "disponível sem PDF", { available: true, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: false },
      { kind: "available", text: "Resultado disponível — liberado em 08/10/2026", downloadable: false } ],
    [ "disponível sem data", { available: true, pickup_at_unit: false, released_on: null, pdf_available: true },
      { kind: "available", text: "Resultado disponível", downloadable: true } ],
    [ "never_citizen", { available: false, pickup_at_unit: true, released_on: "2026-10-08", pdf_available: false },
      { kind: "pickup", text: PICKUP_AT_UNIT } ],
    [ "never_citizen com PDF por engano: retirar vence", { available: true, pickup_at_unit: true, released_on: "2026-10-08", pdf_available: true },
      { kind: "pickup", text: PICKUP_AT_UNIT } ],
    [ "PDF sem available: nada", { available: false, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: true },
      { kind: "none" } ]
  ];
  it.each(cases)("%s", (_name, result, expected) => {
    expect(examResultView(result)).toEqual(expected);
  });
});

describe("examScheduleText e examRequestedText", () => {
  it("marcação com e sem local; sem data, nada", () => {
    expect(examScheduleText(exam())).toBeNull();
    expect(examScheduleText(exam({ scheduled_at: "2026-10-05T07:30:00-03:00" }))).toBe("Marcado para 05/10/2026, 07:30");
    expect(examScheduleText(exam({ scheduled_at: "2026-10-05T07:30:00-03:00", scheduled_place: "Laboratório Simulado — Rua XV, 100" })))
      .toBe("Marcado para 05/10/2026, 07:30 — Laboratório Simulado — Rua XV, 100");
  });

  it("data do pedido; vazia ou inválida, nada", () => {
    expect(examRequestedText(exam())).toBe("Pedido em 01/10/2026");
    expect(examRequestedText(exam({ requested_at: "" }))).toBeNull();
    expect(examRequestedText(exam({ requested_at: "ontem" }))).toBeNull();
  });
});

describe("mergeExams", () => {
  it("junta sem repetir, na ordem", () => {
    const a = exam({ id: "a" }); const b = exam({ id: "b" }); const c = exam({ id: "c" });
    expect(mergeExams([ a, b ], [ b, c ]).map((x) => x.id)).toEqual([ "a", "b", "c" ]);
    expect(mergeExams([], [ a ]).map((x) => x.id)).toEqual([ "a" ]);
  });
});

describe("examFilename: só o id", () => {
  it("letras, números e hífen; nunca nome ou separador de caminho", () => {
    expect(examFilename("0b6f-41a2")).toBe("exame-0b6f-41a2.pdf");
    expect(examFilename("../Hemograma de José/1")).toBe("exame-HemogramadeJos1.pdf");
    expect(examFilename("")).toBe("exame-resultado.pdf");
  });
});
