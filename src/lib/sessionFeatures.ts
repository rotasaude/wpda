// Interruptores LIGADOS da cidade, vindos da sessão do cidadão (módulo 20,
// Divergência W2). Instalados junto com o fuso a cada leitura da sessão,
// como o setCityTimeZone; "Sair" limpa. Ausente (api antigo) = nenhum.
let current: string[] = [];

export function setSessionFeatures(raw: unknown): void {
  current = Array.isArray(raw) ? raw.filter((key): key is string => typeof key === "string") : [];
}

export function hasSessionFeature(key: string): boolean {
  return current.includes(key);
}
