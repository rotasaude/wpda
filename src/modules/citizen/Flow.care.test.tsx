import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type Catalog } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setSessionFeatures(null); window.history.replaceState(null, "", "/"); });

function signedIn(features?: string[]) {
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
  vi.spyOn(citizenApi, "care").mockRejectedValue(new ApiError(403, "not_verified"));
  vi.spyOn(citizenApi, "catalog").mockRejectedValue(new ApiError(409, "profile_required"));
  vi.spyOn(citizenApi, "issueVerificationCode").mockResolvedValue({ code: "482913", expires_at: "2026-10-22T10:10:00-03:00" });
}

async function toMyTriages() {
  render(<Flow />);
  await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
  await userEvent.click(await screen.findByRole("button", { name: "Ver triagens de ***.982.247-**" }));
  expect(await screen.findByRole("heading", { name: "Minhas triagens" })).toBeInTheDocument();
}

describe("Flow — Meu acompanhamento (módulo 23)", () => {
  it("com care_lines: Minhas triagens → Meu acompanhamento → Voltar → Validar no posto", async () => {
    signedIn([ "care_lines" ]);
    await toMyTriages();
    await userEvent.click(screen.getByRole("button", { name: "Meu acompanhamento" }));
    expect(await screen.findByRole("heading", { name: "Meu acompanhamento" })).toBeInTheDocument();
    expect(citizenApi.care).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { name: "Minhas triagens" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Meu acompanhamento" }));
    await userEvent.click(await screen.findByRole("button", { name: "Validar no posto" }));
    expect(await screen.findByText("482913")).toBeInTheDocument();
  });

  it("triagem vencida: Começar abre Qual triagem fazer? para a mesma pessoa", async () => {
    signedIn([ "care_lines" ]);
    vi.spyOn(citizenApi, "care").mockResolvedValue({ lines: [], overdue_triages: [
      { protocol_name: "saude-do-idoso", title: "Saúde do idoso", last_done_at: "2025-10-02" } ] });
    const catalog: Catalog = { in_progress: null, suggested: [], recent: [], reference_units: [],
      available: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Avaliação anual.", overdue: true, last_done_at: "2025-10-02" } ] };
    const catalogSpy = vi.spyOn(citizenApi, "catalog").mockResolvedValue(catalog);
    await toMyTriages();
    await userEvent.click(screen.getByRole("button", { name: "Meu acompanhamento" }));
    await userEvent.click(await screen.findByRole("button", { name: "Começar: Saúde do idoso" }));
    expect(await screen.findByRole("heading", { name: "Qual triagem fazer?" })).toBeInTheDocument();
    expect(catalogSpy).toHaveBeenCalledWith("p1");
  });

  it("com os três interruptores: os três botões", async () => {
    signedIn([ "patient_timeline", "exam_tracking", "care_lines" ]);
    await toMyTriages();
    for (const name of [ "Meu histórico", "Meus exames", "Meu acompanhamento" ]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("sem care_lines na sessão: Minhas triagens como hoje", async () => {
    signedIn([ "exam_tracking" ]);
    await toMyTriages();
    expect(screen.queryByRole("button", { name: "Meu acompanhamento" })).not.toBeInTheDocument();
    expect(citizenApi.care).not.toHaveBeenCalled();
  });
});
