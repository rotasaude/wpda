import { describe, it, expect } from "vitest";
import { ApiError } from "./citizenApi";
import { CARE_DISABLED, CARE_NOT_VERIFIED, CONDITION_OPTIONS, careItemView, careMessage, lastDoneText } from "./care";

describe("careItemView", () => {
  it("tabela das situações; desconhecida não aparece crua", () => {
    expect(careItemView({ label: "consulta com a equipe", status: "ok", due_on: "2027-01-06" }))
      .toEqual({ title: "Consulta com a equipe", status: "Em dia", tone: "ok" });
    expect(careItemView({ label: "medir a pressão", status: "due_soon", due_on: "2026-11-12" }))
      .toEqual({ title: "Medir a pressão", status: "Faça até 12/11/2026", tone: "warn" });
    expect(careItemView({ label: "medir a pressão", status: "due_soon", due_on: null }))
      .toEqual({ title: "Medir a pressão", status: "Está chegando a hora", tone: "warn" });
    expect(careItemView({ label: "exame de hemoglobina glicada", status: "overdue", due_on: "2026-08-20" }))
      .toEqual({ title: "Exame de hemoglobina glicada", status: "Está na hora — procure a sua unidade de saúde", tone: "warn" });
    // O api nunca manda "untracked" (P5a); o ramo existe só como defesa.
    expect(careItemView({ label: "visita do agente de saúde", status: "untracked", due_on: null }))
      .toEqual({ title: "Visita do agente de saúde", status: "Confira com a sua equipe de saúde", tone: "neutral" });
    expect(careItemView({ label: "consulta", status: "paused", due_on: null })).toEqual({ title: "Consulta", status: null, tone: "neutral" });
    expect(careItemView({ label: "", status: "ok", due_on: null }).title).toBe("Cuidado da linha");
  });
});

describe("triagem periódica vencida", () => {
  it("frase da última vez; sem data, nada", () => {
    expect(lastDoneText({ last_done_at: "2025-10-02" })).toBe("Feita pela última vez em 02/10/2025");
    expect(lastDoneText({ last_done_at: "2025-10-02T09:00:00-03:00" })).toBe("Feita pela última vez em 02/10/2025");
    expect(lastDoneText({ last_done_at: null })).toBeNull();
    expect(lastDoneText({})).toBeNull();
  });
});

describe("condições e frases", () => {
  it("quatro opções, sem 'none'; 'Estou grávida' fica para todos (P11)", () => {
    expect(CONDITION_OPTIONS.map((o) => o.value)).toEqual([ "diabetes", "hypertension", "pregnancy", "mental_health" ]);
    expect(CONDITION_OPTIONS.map((o) => o.label)).toEqual([
      "Tenho diabetes", "Tenho pressão alta", "Estou grávida", "Faço acompanhamento de saúde mental"
    ]);
  });

  it("feature_disabled tem a frase do acompanhamento; o resto segue o canal", () => {
    expect(careMessage(new ApiError(403, "feature_disabled"))).toBe(CARE_DISABLED);
    expect(careMessage(new ApiError(422, "invalid_condition"))).toBe("Essa opção não está mais disponível. Atualize a tela.");
    expect(careMessage(new ApiError(401, "unauthenticated"))).toBe("Sua sessão expirou. Entre de novo com seu celular.");
  });

  it("not_verified e not_found têm frase própria; nenhum código cru aparece", () => {
    expect(careMessage(new ApiError(403, "not_verified"))).toBe(CARE_NOT_VERIFIED);
    const gone = careMessage(new ApiError(404, "not_found"));
    expect(gone).toBe("Não encontramos esta pessoa. Volte e escolha de novo.");
    for (const code of [ "not_verified", "not_found", "feature_disabled", "invalid_condition", "unauthenticated", "zzz_desconhecido" ]) {
      expect(careMessage(new ApiError(400, code))).not.toContain(code);
    }
    expect(careMessage(new Error("boom"))).toBe("Sem conexão. Verifique a internet e tente de novo.");
  });
});
