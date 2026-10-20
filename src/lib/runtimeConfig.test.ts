// O container nginx escreve /wpda/runtime-config.js na subida (rotasaude/wpda#2):
// só WPDA_ALLOW_DESKTOP=1 libera; qualquer outro valor, ou nenhum, bloqueia.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "docker/40-wpda-runtime-config.sh");

function run(env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "wpda-runtime-"));
  execFileSync("sh", [ script ], { env: { PATH: process.env.PATH ?? "", WPDA_HTML_DIR: dir, ...env } });
  return readFileSync(join(dir, "runtime-config.js"), "utf8");
}

describe("runtime-config.js gerado pelo container", () => {
  it("WPDA_ALLOW_DESKTOP=1 libera", () => {
    expect(run({ WPDA_ALLOW_DESKTOP: "1" })).toBe("window.__WPDA_RUNTIME__ = { allowDesktop: true };\n");
  });

  it.each([ [ "ausente", {} ], [ "0", { WPDA_ALLOW_DESKTOP: "0" } ], [ "true", { WPDA_ALLOW_DESKTOP: "true" } ] ])(
    "%s bloqueia", (_name, env) => {
      expect(run(env)).toBe("window.__WPDA_RUNTIME__ = { allowDesktop: false };\n");
    });
});

describe("index.html carrega o runtime-config antes do app", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  it("script clássico em /runtime-config.js (o Vite prefixa o base no dev e no build) antes de main.tsx", () => {
    const config = html.indexOf('<script src="/runtime-config.js"></script>');
    expect(config).toBeGreaterThan(-1);
    expect(config).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("o arquivo padrão do build bloqueia (dist servido sem o entrypoint)", () => {
    expect(readFileSync(join(root, "public/runtime-config.js"), "utf8")).toBe("window.__WPDA_RUNTIME__ = { allowDesktop: false };\n");
  });

  it("nginx não deixa o runtime-config em cache", () => {
    const conf = readFileSync(join(root, "nginx.conf"), "utf8");
    expect(conf).toMatch(/location = \/wpda\/runtime-config\.js \{[^}]*Cache-Control "no-cache"/);
  });
});
