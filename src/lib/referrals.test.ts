// src/lib/referrals.test.ts
import { describe, it, expect } from "vitest";
import { ApiError, type CitizenReferral } from "./citizenApi";
import { REFERRALS_DISABLED, referralView, referralsMessage, updatedText } from "./referrals";

const ref = (over: Partial<CitizenReferral>): CitizenReferral => ({ id: "rr1", label: "Consulta em Cardiologia", status: "waiting",
  scheduled_at: null, place: null, updated_at: "2026-10-27T10:00:00-03:00", ...over });
const AT = "2026-11-10T14:30:00-03:00";
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit",
  hour: "2-digit", minute: "2-digit" }).format(new Date(AT));

describe("referralView: tabela das situações; desconhecida vira Em andamento", () => {
  it.each([
    [ "waiting", "Aguardando a regulação", "A Secretaria de Saúde está organizando a vaga. A data e o local chegam por aqui.", "warn" ],
    [ "authorized", "Autorizado — aguardando o agendamento", "A unidade vai marcar o horário. A data e o local chegam por aqui.", "warn" ],
    [ "returned", "Em revisão pela sua unidade", "A sua unidade de saúde está completando o pedido.", "warn" ],
    [ "denied", "Não autorizado", "Procure a sua unidade de saúde para saber os próximos passos.", "neutral" ],
    [ "closed", "Encerrado", "Se ainda precisar, procure a sua unidade de saúde.", "neutral" ],
    [ "completed", "Realizado", null, "ok" ],
    [ "cancelled", "Em andamento", null, "neutral" ],
    [ "external", "Em andamento", null, "neutral" ],
    [ "", "Em andamento", null, "neutral" ]
  ])("%s", (status, text, detail, tone) => {
    const v = referralView(ref({ status }));
    expect(v).toEqual({ title: "Consulta em Cardiologia", status: text, detail, tone });
  });
  it("sem rótulo: Encaminhamento", () => {
    expect(referralView(ref({ label: "" })).title).toBe("Encaminhamento");
  });
});

describe("agendado: com e sem local, data inválida", () => {
  it("data e local", () => {
    expect(referralView(ref({ status: "scheduled", scheduled_at: AT, place: "Ambulatório de Especialidades — Rua XV, 100" })))
      .toEqual({ title: "Consulta em Cardiologia", status: "Agendado", detail: `${when} — Ambulatório de Especialidades — Rua XV, 100`, tone: "accent" });
  });
  it("sem local", () => {
    expect(referralView(ref({ status: "scheduled", scheduled_at: AT })).detail).toBe(`${when} — a unidade informa o local`);
  });
  it("sem data válida", () => {
    for (const at of [ null, "não é data" ]) {
      const v = referralView(ref({ status: "scheduled", scheduled_at: at, place: "Clínica" }));
      expect(v.detail).toBe("A unidade informa a data e o local.");
      expect(JSON.stringify(v)).not.toMatch(/null|undefined|Invalid/);
    }
  });
});

describe("frases e datas", () => {
  it("atualizado em", () => {
    expect(updatedText(ref({}))).toBe("Atualizado em 27/10/2026");
    expect(updatedText(ref({ updated_at: "" }))).toBeNull();
  });
  it("recusas", () => {
    expect(referralsMessage(new ApiError(403, "feature_disabled"))).toBe(REFERRALS_DISABLED);
    expect(referralsMessage(new ApiError(500, "boom"))).not.toMatch(/boom/);
  });
});
