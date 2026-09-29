import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fmtDate, fmtDateTime } from "./format";

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
