// src/modules/citizen/MyReferralsStep.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyReferralsStep } from "./MyReferralsStep";
import { citizenApi, ApiError, type CitizenReferral } from "../../lib/citizenApi";
import { REFERRALS_DISABLED, REFERRALS_EMPTY, REFERRALS_NOT_VERIFIED } from "../../lib/referrals";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const ref = (over: Partial<CitizenReferral>): CitizenReferral => ({ id: "rr", label: "", status: "waiting", scheduled_at: null, place: null,
  updated_at: "2026-10-27T10:00:00-03:00", ...over });
const LIST = [
  ref({ id: "rr1", label: "Consulta em Cardiologia", status: "scheduled", scheduled_at: "2026-11-10T14:30:00-03:00",
    place: "Ambulatório de Especialidades — Rua XV, 100" }),
  ref({ id: "rr2", label: "Ecocardiografia transtorácica", status: "waiting" }),
  ref({ id: "rr3", label: "Consulta em Ortopedia", status: "denied" })
];
const renderStep = (onValidate = vi.fn()) => render(<MyReferralsStep citizenId="p1" onBack={vi.fn()} onValidate={onValidate} />);

describe("MyReferralsStep", () => {
  it("par validado: situação, data e local de cada encaminhamento", async () => {
    const spy = vi.spyOn(citizenApi, "regulationRequests").mockResolvedValue(LIST);
    renderStep();
    const card = await screen.findByRole("listitem", { name: "Consulta em Cardiologia" });
    expect(within(card).getByText("Agendado")).toBeInTheDocument();
    expect(within(card).getByText(/Ambulatório de Especialidades — Rua XV, 100/)).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Ecocardiografia transtorácica" })).getByText("Aguardando a regulação")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Consulta em Ortopedia" })).getByText("Não autorizado")).toBeInTheDocument();
    expect(screen.getAllByText("Atualizado em 27/10/2026")).toHaveLength(3);
    expect(spy).toHaveBeenCalledWith("p1");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("nada de cor, posição, CID ou justificativa na tela", async () => {
    // Mesmo que o cliente deixasse passar (ele não deixa: Task 1), a tela só desenha os campos do contrato.
    const leaky = { ...LIST[1], color: "red", position: 37, cid10: "I209", justification: "Dor aos esforços há três meses" } as unknown as CitizenReferral;
    vi.spyOn(citizenApi, "regulationRequests").mockResolvedValue([ leaky ]);
    renderStep();
    await screen.findByRole("listitem", { name: "Ecocardiografia transtorácica" });
    expect(document.body.textContent).not.toMatch(/vermelh|amarel|verde|azul|\bred\b|posição|position|fila|I209|esforços|prazo|urgente|\b37\b/i);
  });

  it("par declarado (403 not_verified): só o convite", async () => {
    const onValidate = vi.fn();
    vi.spyOn(citizenApi, "regulationRequests").mockRejectedValue(new ApiError(403, "not_verified"));
    renderStep(onValidate);
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toHaveTextContent(REFERRALS_NOT_VERIFIED);
    expect(screen.queryByRole("listitem")).toBeNull();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("vazio", async () => {
    vi.spyOn(citizenApi, "regulationRequests").mockResolvedValue([]);
    renderStep();
    expect(await screen.findByText(REFERRALS_EMPTY)).toBeInTheDocument();
  });

  it("interruptor desligado com a tela aberta: a frase dos encaminhamentos", async () => {
    vi.spyOn(citizenApi, "regulationRequests").mockRejectedValue(new ApiError(403, "feature_disabled"));
    renderStep();
    expect(await screen.findByText(REFERRALS_DISABLED)).toBeInTheDocument();
  });
});
