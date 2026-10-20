// Liberação do fluxo do cidadão no desktop fora de produção (rotasaude/wpda#2),
// exceção à decisão 9 do ciclo de interface. Dev: o dev server do Vite
// (MODE "development"; o vitest roda em "test"). Staging: o container nginx com
// WPDA_ALLOW_DESKTOP=1 escreve window.__WPDA_RUNTIME__ em /wpda/runtime-config.js.
// Sem nenhum dos dois (produção), o bloqueio vale. Só `true` libera.
export function desktopAllowed(win: Window = window): boolean {
  return import.meta.env.MODE === "development" || win.__WPDA_RUNTIME__?.allowDesktop === true;
}
