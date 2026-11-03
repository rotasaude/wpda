import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-02T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setSessionFeatures(null); window.history.replaceState(null, "", "/"); });

function signedIn(features?: string[]) {
  vi.spyOn(citizenApi, "currentSession").mockImplementation(async () => {
    setSessionFeatures(features);
    return { phone_masked: "(**) *****-5432", ...(features ? { features } : {}) };
  });
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({
    people: [ { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null, profile: null } ]
  });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
  vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
  vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments: [] });
  vi.spyOn(citizenApi, "triages").mockResolvedValue({
    citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified" }, triages: []
  });
  return vi.spyOn(citizenApi, "vaccinations").mockResolvedValue({ checked: false, items: [], upcoming: [] });
}

describe("Flow — Minhas vacinas (módulo 29)", () => {
  it("com vaccination: Minhas triagens → Minhas vacinas → Voltar", async () => {
    const spy = signedIn([ "vaccination" ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Concordo" }));
    await user.click(await screen.findByRole("button", { name: "Ver triagens de ***.982.247-**" }));
    await user.click(await screen.findByRole("button", { name: "Minhas vacinas" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas vacinas" })).toBeInTheDocument();
    expect(await screen.findByRole("note", { name: "caderneta não conferida" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("p1");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas triagens" })).toBeInTheDocument();
  });

  it("sem vaccination na sessão: Minhas triagens como hoje", async () => {
    const spy = signedIn([ "care_regulation" ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Concordo" }));
    await user.click(await screen.findByRole("button", { name: "Ver triagens de ***.982.247-**" }));
    await screen.findByRole("heading", { level: 1, name: "Minhas triagens" });
    expect(screen.queryByRole("button", { name: "Minhas vacinas" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
