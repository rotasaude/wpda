// Tema do wpda (spec do subprojeto 4, §3.2): "auto" segue o claro/escuro do
// celular (govbr / govbr-escuro); "alto-contraste" vence o modo do celular.
// Salvo no navegador; se o armazenamento falhar, vale a escolha em memória.
import { useSyncExternalStore } from "react";

export const THEME_KEY = "rotasaude:wpda-theme";
export type WpdaThemeChoice = "auto" | "alto-contraste";
export type WpdaTheme = "govbr" | "govbr-escuro" | "alto-contraste";

const listeners = new Set<() => void>();
let memory: WpdaThemeChoice | null = null;

function read(): string | null {
  try { return window.localStorage.getItem(THEME_KEY); } catch { return null; }
}

function write(v: WpdaThemeChoice): void {
  try { window.localStorage.setItem(THEME_KEY, v); } catch { /* só em memória */ }
}

export function getChoice(): WpdaThemeChoice {
  if (memory) return memory;
  return read() === "alto-contraste" ? "alto-contraste" : "auto";
}

function prefersDark(): boolean {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; }
}

export function effectiveTheme(): WpdaTheme {
  if (getChoice() === "alto-contraste") return "alto-contraste";
  return prefersDark() ? "govbr-escuro" : "govbr";
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = effectiveTheme();
}

export function toggleHighContrast(): void {
  const next: WpdaThemeChoice = getChoice() === "alto-contraste" ? "auto" : "alto-contraste";
  memory = next;
  write(next);
  applyTheme();
  listeners.forEach((l) => l());
}

// Reaplica quando a pessoa troca o modo do celular com a tela aberta.
export function watchSystemTheme(): () => void {
  let mql: MediaQueryList | null = null;
  try { mql = window.matchMedia("(prefers-color-scheme: dark)"); } catch { return () => {}; }
  const onChange = () => applyTheme();
  mql.addEventListener("change", onChange);
  return () => mql?.removeEventListener("change", onChange);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useThemeChoice(): WpdaThemeChoice {
  return useSyncExternalStore(subscribe, getChoice);
}
