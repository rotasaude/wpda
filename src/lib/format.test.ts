import { describe, it, expect } from "vitest";
import { fmtDateTime } from "./format";

describe("fmtDateTime", () => {
  it("formata ISO em pt-BR (data)", () => {
    expect(fmtDateTime("2026-06-26T15:00:00Z")).toMatch(/26\/06\/2026/);
  });
  it("— para null", () => { expect(fmtDateTime(null)).toBe("—"); });
  it("— para data inválida", () => { expect(fmtDateTime("xxx")).toBe("—"); });
});
