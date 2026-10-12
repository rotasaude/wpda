import { describe, expect, it } from "vitest";
import { tierTone } from "./tier";

describe("tierTone", () => {
  it.each([
    [ "alta", "down" ], [ "Alto", "down" ], [ "URGENTE", "down" ], [ "emergência", "down" ], [ "grave", "down" ],
    [ "média", "warn" ], [ "Moderada", "warn" ], [ "intermediária", "warn" ],
    [ "baixa", "ok" ], [ "Leve", "ok" ], [ "verde", "ok" ],
    [ "azul-claro", null ], [ "", null ], [ null, null ]
  ] as const)("%s → %s", (tier, tone) => expect(tierTone(tier)).toBe(tone));
});
