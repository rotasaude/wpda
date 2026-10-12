// Guardas do wpda (spec do subprojeto 4, §5): cor só por papel do tema,
// sem reserva fixa nem nome inexistente; foco nunca zerado; desabilitado
// sem depender de opacidade.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) return n === "vendor" || n === "test" ? [] : files(f);
    return /\.(tsx?)$/.test(n) && !/\.test\./.test(n) ? [f] : [];
  });
}
const all = files(src).map((f) => ({ f: relative(src, f), code: readFileSync(f, "utf8") }));
const offenders = (re: RegExp) => all.filter(({ code }) => re.test(code)).map(({ f }) => f);

describe("guardas de cor e acessibilidade do wpda", () => {
  it("nenhum var(--x, reserva)", () => expect(offenders(/var\(--[\w-]+\s*,/)).toEqual([]));
  it("nenhum branco fixo", () => expect(offenders(/"#fff"|"white"/)).toEqual([]));
  it("nenhum nome de variável inexistente", () => expect(offenders(/--warnBg|--accent-soft/)).toEqual([]));
  it("nenhum outline zerado", () => expect(offenders(/outline:\s*"none"/)).toEqual([]));
  it("desabilitado não depende de opacidade", () => expect(offenders(/opacity:\s*(props\.)?disabled/)).toEqual([]));
});
