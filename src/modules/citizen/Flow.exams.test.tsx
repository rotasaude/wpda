// src/modules/citizen/Flow.exams.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-13T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setSessionFeatures(null); window.history.replaceState(null, "", "/"); });

function signedIn(features?: string[]) {
  // O spy não passa pelo withCityTimeZone do cliente: instala os interruptores como ele faria.
  vi.spyOn(citizenApi, "currentSession").mockImplementation(async () => {
    setSessionFeatures(features);
    return { phone_masked: "(**) *****-5432", ...(features ? { features } : {}) };
  });
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({
    people: [ { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null, profile: null } ]
  });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
  vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
  vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments: [] });
  vi.spyOn(citizenApi, "triages").mockResolvedValue({
    citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }, triages: []
  });
  vi.spyOn(citizenApi, "exams").mockResolvedValue({ verified: false, exams: [], next_before: null });
  vi.spyOn(citizenApi, "issueVerificationCode").mockResolvedValue({ code: "482913", expires_at: "2026-10-13T10:10:00-03:00" });
}

async function toMyTriages() {
  render(<Flow />);
  await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
  await userEvent.click(await screen.findByRole("button", { name: "Ver triagens de ***.982.247-**" }));
  expect(await screen.findByRole("heading", { name: "Minhas triagens" })).toBeInTheDocument();
}

describe("Flow — Meus exames (módulo 21a)", () => {
  it("com exam_tracking: Minhas triagens → Meus exames → Voltar → Validar no posto", async () => {
    signedIn([ "exam_tracking" ]);
    await toMyTriages();
    expect(screen.queryByRole("button", { name: "Meu histórico" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Meus exames" }));
    expect(await screen.findByRole("heading", { name: "Meus exames" })).toBeInTheDocument();
    expect(citizenApi.exams).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { name: "Minhas triagens" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Meus exames" }));
    await userEvent.click(await screen.findByRole("button", { name: "Validar no posto" }));
    expect(await screen.findByText("482913")).toBeInTheDocument();
    expect(citizenApi.issueVerificationCode).toHaveBeenCalledWith("p1");
  });

  it("com os dois interruptores: os dois botões", async () => {
    signedIn([ "patient_timeline", "exam_tracking" ]);
    await toMyTriages();
    expect(screen.getByRole("button", { name: "Meu histórico" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meus exames" })).toBeInTheDocument();
  });

  it("sem exam_tracking na sessão: Minhas triagens como hoje", async () => {
    signedIn([ "patient_timeline" ]);
    await toMyTriages();
    expect(screen.queryByRole("button", { name: "Meus exames" })).not.toBeInTheDocument();
    expect(citizenApi.exams).not.toHaveBeenCalled();
  });
});
