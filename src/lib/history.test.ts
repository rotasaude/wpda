import { describe, it, expect } from "vitest";
import {
  NOT_VERIFIED_INVITE, PARTIAL_NOTICE, citizenKindLabel, citizenStatusLabel, documentFilename, entryPlace, mergeEntries, sinceText,
  vitalsLines
} from "./history";
import type { CitizenEntry } from "./citizenApi";
import { ApiError } from "./citizenApi";
import { messageFor, pdfMessageFor } from "../modules/citizen/ui";

const e = (id: string, over: Partial<CitizenEntry> = {}): CitizenEntry => ({
  id, kind: "triage", occurred_at: "2026-09-09T20:15:00-03:00", unit: null, professional_name: null,
  title: id, summary: null, status: null, document: null, ...over
});

describe("tipos para o cidadão", () => {
  it("rótulos do contrato; desconhecido vira Registro", () => {
    expect(citizenKindLabel("screening")).toBe("Acolhimento");
    expect(citizenKindLabel("controlled_notification")).toBe("Receita de controle especial");
    expect(citizenKindLabel("clinical_document")).toBe("Documento");
    expect(citizenKindLabel("procedure")).toBe("Procedimento");
    expect(citizenKindLabel("vaccination")).toBe("Registro");
    expect(citizenKindLabel("")).toBe("Registro");
  });

  it("situação em português; código desconhecido não aparece", () => {
    expect(citizenStatusLabel("confirmed")).toBe("confirmado");
    expect(citizenStatusLabel("cancelled_by_citizen")).toBe("cancelado por você");
    expect(citizenStatusLabel("issued")).toBe("emitido");
    expect(citizenStatusLabel("cancelled")).toBe("cancelado");
    expect(citizenStatusLabel("read")).toBe("aviso lido");
    expect(citizenStatusLabel("something_new")).toBeNull();
    expect(citizenStatusLabel(null)).toBeNull();
  });
});

describe("mergeEntries: junta sem repetir, na ordem", () => {
  it("a repetida da página seguinte some; a ordem do api fica", () => {
    expect(mergeEntries([ e("a"), e("b") ], [ e("b"), e("c") ]).map((x) => x.id)).toEqual([ "a", "b", "c" ]);
    expect(mergeEntries([], [ e("a") ]).map((x) => x.id)).toEqual([ "a" ]);
  });
});

describe("textos", () => {
  it("onde e com quem", () => {
    expect(entryPlace(e("x", { unit: { name: "UBS Centro" }, professional_name: "Dra. Helena Prado" }))).toBe("UBS Centro · Dra. Helena Prado");
    expect(entryPlace(e("x", { unit: { name: "UBS Centro" } }))).toBe("UBS Centro");
    expect(entryPlace(e("x"))).toBeNull();
  });

  it("desde quando", () => {
    expect(sinceText("2019-03-01")).toBe("desde 01/03/2019");
    expect(sinceText(null)).toBeNull();
    expect(sinceText("2019-03")).toBeNull();
  });

  it("sinais: só o que existe, com a data", () => {
    expect(vitalsLines({
      blood_pressure: { systolic: 130, diastolic: 85, measured_at: "2026-09-10T14:30:00-03:00" },
      weight_kg: { value: 72.5, measured_at: "2026-09-10T14:30:00-03:00" },
      capillary_glucose: { value: 110, moment: "fasting", measured_at: "2026-08-02T08:00:00-03:00" }
    })).toEqual([
      "Pressão: 130/85 mmHg — 10/09/2026",
      "Peso: 72,5 kg — 10/09/2026",
      "Glicemia capilar: 110 mg/dL (em jejum) — 02/08/2026"
    ]);
    expect(vitalsLines({ capillary_glucose: { value: 180, moment: null, measured_at: "2026-08-02T08:00:00-03:00" } }))
      .toEqual([ "Glicemia capilar: 180 mg/dL — 02/08/2026" ]);
    expect(vitalsLines({})).toEqual([]);
  });

  it("nome do arquivo: só o código (ou o id), nada pessoal", () => {
    expect(documentFilename({ id: "doc2", short_code: "P3H8T-2LQ6R", verification_url: null, downloadable: true }))
      .toBe("documento-P3H8T-2LQ6R.pdf");
    expect(documentFilename({ id: "doc2", short_code: null, verification_url: null, downloadable: true })).toBe("documento-doc2.pdf");
    expect(documentFilename({ id: "../x y", short_code: "a/b", verification_url: null, downloadable: true })).toBe("documento-ab.pdf");
  });

  it("os avisos dizem o essencial", () => {
    expect(PARTIAL_NOTICE).toMatch(/só o que passou pelo Rota Saúde/);
    expect(NOT_VERIFIED_INVITE).toMatch(/valide seu cadastro/);
  });

  it("frases novas das recusas", () => {
    expect(messageFor(new ApiError(403, "feature_disabled"))).toBe("O histórico ainda não está disponível nesta cidade.");
    expect(messageFor(new ApiError(403, "not_verified"))).toBe("Para ver isto, valide seu cadastro na unidade de saúde.");
    expect(messageFor(new ApiError(404, "not_available"))).toBe("O resumo de saúde ainda não está disponível.");
    expect(messageFor(new ApiError(422, "invalid_cursor"))).toBe("A lista mudou. Volte e abra o histórico de novo.");
  });

  it("PDF com 429: frase de downloads; as outras recusas seguem as de sempre", () => {
    expect(pdfMessageFor(new ApiError(429, "too_many_requests")))
      .toBe("Muitos downloads em pouco tempo. Tente de novo em alguns minutos.");
    expect(pdfMessageFor(new ApiError(403, "not_verified"))).toBe(messageFor(new ApiError(403, "not_verified")));
    expect(pdfMessageFor(new Error("offline"))).toBe(messageFor(new Error("offline")));
    // O código é o mesmo do SMS: a frase geral não muda.
    expect(messageFor(new ApiError(429, "too_many_requests"))).toBe("Muitas tentativas. Aguarde um pouco e tente de novo.");
  });
});
