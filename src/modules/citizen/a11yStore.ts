// Página de acessibilidade aberta? Estado global mínimo: a página é
// sobreposta ao conteúdo (que fica hidden, sem desmontar o fluxo).
// Abrir empilha uma entrada própria no histórico: o "voltar" do celular fecha
// a página em vez de sair do site (A-14).
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const ours = () => Boolean((window.history.state as { a11y?: boolean } | null)?.a11y);

export function openA11y(): void {
  if (open) return;
  open = true;
  try { window.history.pushState({ a11y: true }, ""); } catch { /* sem histórico: só não fecha pelo "voltar" */ }
  emit();
}

export function closeA11y(): void {
  if (!open) return;
  open = false;
  emit();
  // Desfaz a entrada empilhada ao abrir; o popstate que vem depois já acha a página fechada.
  if (ours()) window.history.back();
}

window.addEventListener("popstate", () => {
  if (open && !ours()) { open = false; emit(); }
});

export function useA11yOpen(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => open);
}
