// Nível do resultado → tom (spec do subprojeto 4, §4.2). O nível é texto
// livre do autor do protocolo; termos desconhecidos ficam neutros.
export type TierTone = "down" | "warn" | "ok";

const TONES: Record<string, TierTone> = {
  alta: "down", alto: "down", urgente: "down", emergencia: "down", emergente: "down", grave: "down", vermelho: "down",
  media: "warn", medio: "warn", moderada: "warn", moderado: "warn", intermediaria: "warn", amarelo: "warn",
  baixa: "ok", baixo: "ok", leve: "ok", verde: "ok"
};

export function tierTone(tier: string | null | undefined): TierTone | null {
  if (!tier) return null;
  const key = tier.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return TONES[key] ?? null;
}

export const TONE_GLYPH: Record<TierTone, "square" | "triangle" | "circle"> = { down: "square", warn: "triangle", ok: "circle" };
