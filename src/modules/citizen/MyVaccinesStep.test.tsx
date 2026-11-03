// src/modules/citizen/MyVaccinesStep.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyVaccinesStep } from "./MyVaccinesStep";
import { citizenApi, ApiError, type CitizenVaccinations } from "../../lib/citizenApi";
import { VACCINES_DISABLED, VACCINES_EMPTY, VACCINES_NOT_VERIFIED, VACCINES_UNCHECKED } from "../../lib/vaccinations";

beforeEach(() => { vi.useFakeTimers({ toFake: [ "Date" ] }); vi.setSystemTime(new Date("2026-11-02T10:00:00-03:00")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const CHECKED: CitizenVaccinations = {
  checked: true,
  items: [
    { immunobiological_name: "Pentavalente", dose_name: "2ª dose", applied_on: "2026-09-10", place_name: "UBS Vila Verde", transcription: false, rnds: "sent" },
    { immunobiological_name: "BCG", dose_name: "Dose única", applied_on: "2026-03-01", place_name: null, transcription: true, rnds: "sending" }
  ],
  upcoming: [ { immunobiological_name: "Pentavalente", dose_name: "3ª dose", due_on: "2026-11-10" } ]
};
const renderStep = (onValidate = vi.fn()) => render(<MyVaccinesStep citizenId="p1" onBack={vi.fn()} onValidate={onValidate} />);

describe("MyVaccinesStep", () => {
  it("conferida: doses com envio e próximas doses", async () => {
    const spy = vi.spyOn(citizenApi, "vaccinations").mockResolvedValue(CHECKED);
    renderStep();
    const penta = await screen.findByRole("listitem", { name: "Pentavalente — 2ª dose" });
    expect(within(penta).getByText("Aplicada em 10/09/2026 — UBS Vila Verde")).toBeInTheDocument();
    expect(within(penta).getByText("Enviada ao Ministério")).toBeInTheDocument();
    const bcg = screen.getByRole("listitem", { name: "BCG — Dose única" });
    expect(within(bcg).getByText("Aplicada em 01/03/2026 — registrada a partir da caderneta")).toBeInTheDocument();
    expect(within(bcg).getByText("Em envio")).toBeInTheDocument();
    const next = within(screen.getByRole("region", { name: "Próximas doses" }));
    expect(next.getByRole("listitem", { name: "Pentavalente — 3ª dose" })).toHaveTextContent("A partir de 10/11/2026");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("p1");
  });

  it("caderneta não conferida: o texto da caderneta e nenhuma próxima dose", async () => {
    vi.spyOn(citizenApi, "vaccinations").mockResolvedValue({ ...CHECKED, checked: false, upcoming: [] });
    renderStep();
    expect(await screen.findByRole("note", { name: "caderneta não conferida" })).toHaveTextContent(VACCINES_UNCHECKED);
    expect(within(screen.getByRole("region", { name: "Próximas doses" })).queryByRole("listitem")).toBeNull();
    expect(screen.getByRole("listitem", { name: "Pentavalente — 2ª dose" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/atrasad/i);
  });

  it("nada de lote, fabricante ou vacinador na tela", async () => {
    const leaky = { ...CHECKED, items: [ { ...CHECKED.items[0], lot: { number: "AB123" }, manufacturer: "Serum", by: { name: "Ana Souza" } } ] };
    vi.spyOn(citizenApi, "vaccinations").mockResolvedValue(leaky as unknown as CitizenVaccinations);
    renderStep();
    await screen.findByRole("listitem", { name: "Pentavalente — 2ª dose" });
    expect(document.body.textContent).not.toMatch(/AB123|Serum|Ana Souza|lote|fabricante|undefined|null/i);
  });

  it("par declarado (403 not_verified): só o convite", async () => {
    const onValidate = vi.fn();
    vi.spyOn(citizenApi, "vaccinations").mockRejectedValue(new ApiError(403, "not_verified"));
    renderStep(onValidate);
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toHaveTextContent(VACCINES_NOT_VERIFIED);
    expect(screen.queryByRole("listitem")).toBeNull();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("vazio e interruptor caindo com a tela aberta", async () => {
    vi.spyOn(citizenApi, "vaccinations").mockResolvedValueOnce({ checked: true, items: [], upcoming: [] });
    const { unmount } = renderStep();
    expect(await screen.findByText(VACCINES_EMPTY)).toBeInTheDocument();
    unmount();
    vi.spyOn(citizenApi, "vaccinations").mockRejectedValueOnce(new ApiError(403, "feature_disabled"));
    renderStep();
    expect(await screen.findByText(VACCINES_DISABLED)).toBeInTheDocument();
  });
});
