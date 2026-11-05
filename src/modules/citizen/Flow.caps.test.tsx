// Módulo 31 (ADR 0049, decisão 4): o CAPS não existe no canal web. `psychosocial_care` pode vir em `features`
// (o api já o esconde da sessão do cidadão, CITIZEN_HIDDEN), mas nenhum botão muda.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, type AppointmentItem } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-04T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setSessionFeatures(null); window.history.replaceState(null, "", "/"); });

// Agendamento comum da UBS (agenda do módulo 17): é o que "Seus agendamentos" mostra; o CAPS não usa essa agenda.
const UBS_APPOINTMENT: AppointmentItem = {
  request: { id: "r1", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: null },
  appointment: null
};

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
  vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments: [ UBS_APPOINTMENT ] });
  vi.spyOn(citizenApi, "triages").mockResolvedValue({
    citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified" }, triages: []
  });
  return vi.spyOn(citizenApi, "history").mockResolvedValue({ verified: true, partial: false, entries: [], next_before: null });
}

async function triageButtons(features: string[]) {
  signedIn(features);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<Flow />);
  await user.click(await screen.findByRole("button", { name: "Concordo" }));
  await user.click(await screen.findByRole("button", { name: "Ver triagens de ***.982.247-**" }));
  await screen.findByRole("heading", { level: 1, name: "Minhas triagens" });
  await screen.findByRole("heading", { name: "Seus agendamentos" });
  const names = screen.getAllByRole("button").map(b => b.textContent);
  const text = document.body.textContent;
  view.unmount(); vi.restoreAllMocks(); setSessionFeatures(null);
  return { names, text };
}

describe("Flow — nada do CAPS (módulo 31)", () => {
  it("psychosocial_care na sessão: Minhas triagens igual", async () => {
    const base = [ "patient_timeline", "clinical_record" ];
    const without = await triageButtons(base);
    const withCaps = await triageButtons([ ...base, "psychosocial_care" ]);
    expect(withCaps.names).toEqual(without.names);
    expect(withCaps.text).not.toMatch(/CAPS|psicossocial|psychosocial/i);
  });
});
