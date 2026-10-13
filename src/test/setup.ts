import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// sessionStorage guarda a retomada da triagem (WP-06): cada teste começa limpo.
afterEach(() => { cleanup(); sessionStorage.clear(); });

// Ambiente padrão dos testes: um celular em modo claro (o wpda bloqueia o
// fluxo fora do celular e o tema segue prefers-color-scheme). Testes de
// bloqueio e de tema sobrescrevem estes valores.
import { beforeEach } from "vitest";

export function stubDevice({ width = 390, height = 844, coarse = true, dark = false } = {}) {
  Object.defineProperty(window, "screen", { configurable: true, value: { width, height } });
  window.matchMedia = ((query: string) => ({
    matches: (query.includes("pointer: coarse") && coarse) || (query.includes("prefers-color-scheme: dark") && dark),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  stubDevice();
  // O jsdom não implementa scrollTo e polui a saída; o Screen rola ao topo a cada tela.
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});
