import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopAllowed } from "./desktopAllowed";

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.__WPDA_RUNTIME__;
});

describe("desktopAllowed (rotasaude/wpda#2)", () => {
  it("bloqueia por padrão: sem dev server e sem runtime-config (produção)", () => {
    expect(desktopAllowed()).toBe(false);
  });

  it("libera no dev server do Vite", () => {
    vi.stubEnv("MODE", "development");
    expect(desktopAllowed()).toBe(true);
  });

  it("libera quando o container declara allowDesktop: true (staging)", () => {
    window.__WPDA_RUNTIME__ = { allowDesktop: true };
    expect(desktopAllowed()).toBe(true);
  });

  it.each([
    [ "allowDesktop: false", { allowDesktop: false } ],
    [ "objeto vazio", {} ],
    [ "valor que não é booleano", { allowDesktop: "true" } ]
  ])("continua bloqueando com %s", (_name, runtime) => {
    window.__WPDA_RUNTIME__ = runtime as Window["__WPDA_RUNTIME__"];
    expect(desktopAllowed()).toBe(false);
  });
});
