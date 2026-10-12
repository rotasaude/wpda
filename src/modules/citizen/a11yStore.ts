// Página de acessibilidade aberta? Estado global mínimo: a página é
// sobreposta ao conteúdo (que fica hidden, sem desmontar o fluxo).
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openA11y(): void { open = true; emit(); }
export function closeA11y(): void { open = false; emit(); }
export function useA11yOpen(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => open);
}
