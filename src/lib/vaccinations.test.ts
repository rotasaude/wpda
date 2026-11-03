import { describe, it, expect } from "vitest";
import { ApiError, type CitizenVaccineDose } from "./citizenApi";
import {
  VACCINES_DISABLED, VACCINES_RNDS_HELP, VACCINES_UNCHECKED, appliedText, doseTitle, rndsText, upcomingText, vaccinationsMessage
} from "./vaccinations";

const dose = (over: Partial<CitizenVaccineDose> = {}): CitizenVaccineDose => ({
  immunobiological_name: "Pentavalente", dose_name: "2ª dose", applied_on: "2026-09-10",
  place_name: "UBS Vila Verde", transcription: false, rnds: "sent", ...over
});

describe("vaccinations", () => {
  it("textos fixos", () => {
    expect(VACCINES_UNCHECKED).toBe(
      "Leve a caderneta de vacinação à sala de vacina da sua unidade de saúde. Depois que a equipe conferir, as próximas doses aparecem aqui.");
    expect(VACCINES_RNDS_HELP).toBe(
      "“Enviada ao Ministério” quer dizer que a dose também aparece no Meu SUS Digital. “Em envio” quer dizer que ela ainda está a caminho.");
    expect(VACCINES_DISABLED).toBe("As vacinas ainda não aparecem por aqui nesta cidade.");
  });

  it("doseTitle: vacina e dose; faltando, só o que veio ou Vacina", () => {
    expect(doseTitle(dose())).toBe("Pentavalente — 2ª dose");
    expect(doseTitle(dose({ dose_name: "" }))).toBe("Pentavalente");
    expect(doseTitle(dose({ immunobiological_name: " ", dose_name: "" }))).toBe("Vacina");
  });

  it("appliedText: data e local; transcrição; data inválida some", () => {
    expect(appliedText(dose())).toBe("Aplicada em 10/09/2026 — UBS Vila Verde");
    expect(appliedText(dose({ place_name: null }))).toBe("Aplicada em 10/09/2026");
    expect(appliedText(dose({ transcription: true, place_name: null }))).toBe("Aplicada em 10/09/2026 — registrada a partir da caderneta");
    expect(appliedText(dose({ applied_on: "x" }))).toBeNull();
  });

  it("rndsText: só sent e sending; o resto some", () => {
    expect(rndsText("sent")).toEqual({ label: "Enviada ao Ministério", tone: "ok" });
    expect(rndsText("sending")).toEqual({ label: "Em envio", tone: "warn" });
    expect(rndsText(null)).toBeNull();
    expect(rndsText("blocked" as never)).toBeNull();
  });

  it("upcomingText: passada, hoje, futura, nula e inválida", () => {
    const u = (due_on: string | null) => ({ immunobiological_name: "Tríplice viral", dose_name: "1ª dose", due_on });
    expect(upcomingText(u("2026-10-01"), "2026-11-02")).toBe("Já pode tomar desde 01/10/2026");
    expect(upcomingText(u("2026-11-02"), "2026-11-02")).toBe("Já pode tomar desde 02/11/2026");
    expect(upcomingText(u("2026-12-15"), "2026-11-02")).toBe("A partir de 15/12/2026");
    expect(upcomingText(u(null), "2026-11-02")).toBe("A unidade informa a data");
    expect(upcomingText(u("15/12/2026"), "2026-11-02")).toBe("A unidade informa a data");
  });

  it("vaccinationsMessage: interruptor desligado tem frase própria", () => {
    expect(vaccinationsMessage(new ApiError(403, "feature_disabled"))).toBe(VACCINES_DISABLED);
  });
});
