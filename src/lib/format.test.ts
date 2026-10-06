import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cityTimeZone, cityToday, fmtCalendarDate, fmtDate, fmtDateTime, fmtDayMonth, fmtHourMinute, fmtWeekdayDateTime, setCityTimeZone
} from "./format";

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

// Datas de calendário do módulo 15 (nascimento, sugerida em, próxima a partir
// de): sem hora nem fuso. new Date("2026-10-02") seria 01/10 em Brasília.
describe("fmtCalendarDate", () => {
  it("AAAA-MM-DD vira DD/MM/AAAA, sem deslocar o dia pelo fuso", () => {
    expect(fmtCalendarDate("2026-10-02")).toBe("02/10/2026");
    expect(fmtCalendarDate("2027-01-01")).toBe("01/01/2027");
  });
  it("vale em qualquer fuso de cidade", () => {
    setCityTimeZone("America/Manaus");
    expect(fmtCalendarDate("2026-10-02")).toBe("02/10/2026");
    setCityTimeZone(null);
  });
  it.each([ null, undefined, "", "2026-10-02T00:00:00Z", "02/10/2026", "2026-1-2" ])("%s vira —", (v) => {
    expect(fmtCalendarDate(v)).toBe("—");
  });
});

// Módulo 17: prazo previsto do pedido (data de calendário) e horário marcado
// com início e fim no fuso da cidade.
describe("datas do módulo 17", () => {
  afterEach(() => setCityTimeZone(null));

  it("fmtDayMonth: AAAA-MM-DD vira DD/MM, sem deslocar o dia pelo fuso", () => {
    expect(fmtDayMonth("2026-10-31")).toBe("31/10");
    expect(fmtDayMonth("2027-01-01")).toBe("01/01");
  });
  it("fmtDayMonth não depende do fuso da cidade", () => {
    setCityTimeZone("America/Manaus");
    expect(fmtDayMonth("2026-10-31")).toBe("31/10");
  });
  it.each([ null, undefined, "", "2026-10-31T00:00:00Z", "31/10/2026" ])("fmtDayMonth(%s) vira —", (v) => {
    expect(fmtDayMonth(v)).toBe("—");
  });

  it("fmtWeekdayDateTime: dia da semana, data e hora no fuso da cidade", () => {
    expect(fmtWeekdayDateTime("2026-10-08T09:00:00-03:00")).toBe("qui., 08/10, 09:00");
  });
  it("fmtHourMinute: só a hora, no fuso da cidade", () => {
    expect(fmtHourMinute("2026-10-08T12:20:00Z")).toBe("09:20");
    setCityTimeZone("America/Manaus");
    expect(fmtHourMinute("2026-10-08T12:20:00Z")).toBe("08:20");
  });
  it.each([ null, undefined, "xxx" ])("%s vira — em fmtHourMinute e fmtWeekdayDateTime", (v) => {
    expect(fmtHourMinute(v)).toBe("—");
    expect(fmtWeekdayDateTime(v)).toBe("—");
  });
});

// Hoje da cidade "AAAA-MM-DD" (esconde prazo previsto vencido, módulo 17).
describe("cityToday", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: [ "Date" ] }));
  afterEach(() => { vi.useRealTimers(); setCityTimeZone(null); });

  it("o dia de hoje no fuso da cidade", () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00-03:00"));
    expect(cityToday()).toBe("2026-10-06");
  });
  it("perto da meia-noite usa o dia de São Paulo, não o de UTC", () => {
    vi.setSystemTime(new Date("2026-10-31T02:30:00Z"));
    expect(cityToday()).toBe("2026-10-30");
  });
  it("segue o fuso da cidade (Manaus)", () => {
    // 03h30 UTC: 00h30 de 3/10 em São Paulo, 23h30 de 2/10 em Manaus.
    vi.setSystemTime(new Date("2026-10-03T03:30:00Z"));
    expect(cityToday()).toBe("2026-10-03");
    setCityTimeZone("America/Manaus");
    expect(cityToday()).toBe("2026-10-02");
  });
});
