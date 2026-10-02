import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cityTimeZone, fmtDate, fmtDateTime, setCityTimeZone } from "./format";

describe("fmtDateTime", () => {
  it("formata ISO em pt-BR (data)", () => {
    expect(fmtDateTime("2026-06-26T15:00:00Z")).toMatch(/26\/06\/2026/);
  });
  it("— para null", () => { expect(fmtDateTime(null)).toBe("—"); });
  it("— para data inválida", () => { expect(fmtDateTime("xxx")).toBe("—"); });
});

describe("fmtDate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date("2026-09-29T10:00:00-03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("só a data, dd/mm/aaaa", () => {
    expect(fmtDate("2026-09-28T13:00:00-03:00")).toBe("28/09/2026");
  });
  it("perto da meia-noite usa o dia de São Paulo, não o de UTC", () => {
    expect(fmtDate("2026-09-29T02:30:00Z")).toBe("28/09/2026");
  });
  it.each([ null, undefined, "", "xxx" ])("%s vira —", (iso) => {
    expect(fmtDate(iso)).toBe("—");
  });
});

describe("fuso da cidade (api#27)", () => {
  afterEach(() => setCityTimeZone(null));

  // 03h30 UTC: 00h30 de 3/10 em São Paulo, 23h30 de 2/10 em Manaus.
  const AT = "2026-10-03T03:30:00Z";

  it("sem sessão, horário de Brasília", () => {
    expect(cityTimeZone()).toBe("America/Sao_Paulo");
    expect(fmtDateTime(AT)).toBe("03/10/2026, 00:30");
  });

  it("em Manaus, data e hora no fuso dela", () => {
    setCityTimeZone("America/Manaus");
    expect(fmtDateTime(AT)).toBe("02/10/2026, 23:30");
    expect(fmtDate(AT)).toBe("02/10/2026");
  });
});
