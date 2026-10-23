import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyCareStep } from "./MyCareStep";
import { ApiError, citizenApi, type CitizenCare } from "../../lib/citizenApi";
import { CARE_DISABLED, CARE_EMPTY, CARE_NOT_VERIFIED } from "../../lib/care";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-22T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// P5a: o api nunca manda "untracked"; a fixture só tem itens rastreados.
const CARE: CitizenCare = { lines: [ { name: "Pessoa com diabetes", items: [
  { label: "consulta com a equipe", status: "ok", due_on: "2027-01-06" },
  { label: "medir a pressão", status: "due_soon", due_on: "2026-11-12" },
  { label: "exame de hemoglobina glicada", status: "overdue", due_on: "2026-08-20" },
  { label: "exame dos pés", status: "ok", due_on: "2027-03-10" }
] } ], overdue_triages: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", last_done_at: "2025-10-02" } ] };

function setup(care: CitizenCare | Error = CARE) {
  const careSpy = vi.spyOn(citizenApi, "care");
  if (care instanceof Error) careSpy.mockRejectedValue(care); else careSpy.mockResolvedValue(care);
  const onValidate = vi.fn();
  render(<MyCareStep citizenId="p1" onBack={vi.fn()} onValidate={onValidate} />);
  return { careSpy, onValidate };
}

describe("MyCareStep", () => {
  it("par validado: cada item em linguagem simples, pela situação", async () => {
    const { careSpy } = setup();
    const line = await screen.findByRole("region", { name: "Pessoa com diabetes" });
    expect(careSpy).toHaveBeenCalledWith("p1");
    const item = (name: string) => within(line).getByRole("listitem", { name });
    expect(within(item("Consulta com a equipe")).getByText("Em dia")).toBeInTheDocument();
    expect(within(item("Medir a pressão")).getByText("Faça até 12/11/2026")).toBeInTheDocument();
    expect(within(item("Exame de hemoglobina glicada")).getByText("Está na hora — procure a sua unidade de saúde")).toBeInTheDocument();
    expect(within(item("Exame dos pés")).getByText("Em dia")).toBeInTheDocument();
  });

  it("triagem periódica vencida: o aviso com a última vez e onde fazer", async () => {
    setup();
    const screenings = await screen.findByRole("region", { name: "Triagens para refazer" });
    const item = within(screenings).getByRole("listitem", { name: "Saúde do idoso" });
    expect(within(item).getByText("Feita pela última vez em 02/10/2025")).toBeInTheDocument();
    // C06: a tela não tem como iniciar a triagem; ela nomeia onde fazer.
    expect(within(screenings).getByText(/Qual triagem fazer\?/)).toBeInTheDocument();
  });

  it("sem triagem vencida: sem o aviso, o resto aparece", async () => {
    setup({ ...CARE, overdue_triages: [] });
    expect(await screen.findByRole("region", { name: "Pessoa com diabetes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Triagens para refazer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("nada de código, CID ou motivo: só os campos do contrato", async () => {
    const leaky = { overdue_triages: [], lines: [ { name: "Pessoa com diabetes", reason: "problem", ended_reason: "moved", suggestion: "age_sex",
      items: [ { label: "medir a pressão", status: "brand_new", due_on: null, ciap: "T90", cid10: "E11" } ] } ] };
    setup(leaky as unknown as CitizenCare);
    const line = await screen.findByRole("region", { name: "Pessoa com diabetes" });
    expect(within(line).getByRole("listitem", { name: "Medir a pressão" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/T90|E11|problem|moved|age_sex|brand_new/);
  });

  it("par declarado (403 not_verified): só o convite e Validar no posto", async () => {
    const { onValidate } = setup(new ApiError(403, "not_verified"));
    expect((await screen.findByRole("note", { name: "cadastro não validado" })).textContent).toBe(CARE_NOT_VERIFIED);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Triagens para refazer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("sem linhas: a frase de vazio, sem sugerir nada", async () => {
    setup({ lines: [], overdue_triages: [] });
    expect(await screen.findByText(CARE_EMPTY)).toBeInTheDocument();
  });

  it("interruptor desligado com a tela aberta: a frase do acompanhamento", async () => {
    setup(new ApiError(403, "feature_disabled"));
    expect(await screen.findByRole("alert")).toHaveTextContent(CARE_DISABLED);
  });
});
