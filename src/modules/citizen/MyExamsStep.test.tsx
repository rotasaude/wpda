// src/modules/citizen/MyExamsStep.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyExamsStep } from "./MyExamsStep";
import { citizenApi, ApiError, type CitizenExam, type CitizenExams } from "../../lib/citizenApi";
import { EXAMS_DISABLED, EXAMS_EMPTY, EXAMS_NOT_VERIFIED, EXAM_PDF_GONE, PICKUP_AT_UNIT } from "../../lib/exams";
import { PDF_RATE_LIMITED } from "./ui";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-13T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const exam = (over: Partial<CitizenExam>): CitizenExam => ({
  id: "x", label: "", status_label: "", requested_at: "2026-10-01T09:00:00-03:00",
  scheduled_at: null, scheduled_place: null, result: null, ...over
});
const IMMEDIATE = exam({ id: "ex-imm", label: "Hemograma completo", status_label: "Resultado disponível",
  scheduled_at: "2026-10-05T07:30:00-03:00", scheduled_place: "Laboratório Simulado — Rua XV, 100",
  result: { available: true, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: true } });
const AFTER_ACK = exam({ id: "ex-ack", label: "Hemoglobina glicada", status_label: "Coletado",
  scheduled_at: "2026-10-05T07:30:00-03:00", scheduled_place: "Laboratório Simulado — Rua XV, 100" });
const NEVER = exam({ id: "ex-unit", label: "Sorologia para HIV", status_label: "Retire o resultado na sua unidade",
  result: { available: false, pickup_at_unit: true, released_on: null, pdf_available: false } });
const DENIED = exam({ id: "ex-den", label: "Ressonância magnética", status_label: "Não autorizado — procure a sua unidade" });

const page = (over: Partial<CitizenExams> = {}): CitizenExams =>
  ({ verified: true, exams: [ IMMEDIATE, AFTER_ACK, NEVER, DENIED ], next_before: null, ...over });

const renderStep = (onValidate = vi.fn(), onBack = vi.fn()) =>
  render(<MyExamsStep citizenId="p1" onBack={onBack} onValidate={onValidate} />);

function fakeBlobUrl(href = "blob:http://curitiba.localhost/abc") {
  const createObjectURL = vi.fn(() => href);
  const revokeObjectURL = vi.fn();
  // O jsdom não tem createObjectURL/revokeObjectURL: um URL dublê no global, desfeito pelo unstubAllGlobals.
  class FakeURL extends URL {}
  Object.assign(FakeURL, { createObjectURL, revokeObjectURL });
  vi.stubGlobal("URL", FakeURL);
  return { createObjectURL, revokeObjectURL };
}

describe("MyExamsStep", () => {
  it("par validado: situação, marcação e laudo pelas três políticas", async () => {
    const spy = vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    renderStep();

    const imm = await screen.findByRole("listitem", { name: "Hemograma completo" });
    expect(spy).toHaveBeenCalledWith("p1");
    expect(within(imm).getByText("Pedido em 01/10/2026")).toBeInTheDocument();
    expect(within(imm).getByText("Marcado para 05/10/2026, 07:30 — Laboratório Simulado — Rua XV, 100")).toBeInTheDocument();
    expect(within(imm).getByText("Resultado disponível — liberado em 08/10/2026")).toBeInTheDocument();
    expect(within(imm).queryByText("Resultado disponível", { exact: true })).not.toBeInTheDocument();
    expect(within(imm).getByRole("button", { name: "Baixar resultado de Hemograma completo" })).toBeInTheDocument();

    const ack = screen.getByRole("listitem", { name: "Hemoglobina glicada" });
    expect(within(ack).getByText("Coletado")).toBeInTheDocument();
    expect(within(ack).queryByRole("button")).not.toBeInTheDocument();
    expect(within(ack).queryByText(/Resultado disponível/)).not.toBeInTheDocument();

    const never = screen.getByRole("listitem", { name: "Sorologia para HIV" });
    expect(within(never).getByText(PICKUP_AT_UNIT)).toBeInTheDocument();
    expect(within(never).queryByText("Retire o resultado na sua unidade", { exact: true })).not.toBeInTheDocument();
    expect(within(never).queryByRole("button")).not.toBeInTheDocument();

    const denied = screen.getByRole("listitem", { name: "Ressonância magnética" });
    expect(within(denied).getByText("Não autorizado — procure a sua unidade")).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "cadastro não validado" })).not.toBeInTheDocument();
  });

  it("exame sem rótulo: usa \"Exame\" no título, no item e no botão", async () => {
    const unnamed = exam({ id: "ex-n", label: "", status_label: "Resultado disponível",
      result: { available: true, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: true } });
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page({ exams: [ unnamed ] }));
    renderStep();
    const item = await screen.findByRole("listitem", { name: "Exame" });
    expect(within(item).getByText("Exame")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Baixar resultado de Exame" })).toBeInTheDocument();
  });

  it("nada de crítico, motivo ou valor: só os campos do contrato aparecem", async () => {
    const leaky = { ...IMMEDIATE, critical: true, denial_reason: "fora do protocolo municipal",
      values: [ { label: "Hemoglobina", value: "6,1" } ], requester_name: "Dr. Fulano" };
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page({ exams: [ leaky as unknown as CitizenExam ] }));
    renderStep();
    await screen.findByRole("listitem", { name: "Hemograma completo" });
    expect(document.body.textContent).not.toMatch(/crític|fora do protocolo|6,1|Fulano/i);
  });

  it("par declarado: convite e nenhum exame, mesmo se o api mandar", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page({ verified: false }));
    const onValidate = vi.fn();
    renderStep(onValidate);
    expect((await screen.findByRole("note", { name: "cadastro não validado" })).textContent).toBe(EXAMS_NOT_VERIFIED);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText("Hemograma completo")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("403 not_verified: o mesmo convite, sem erro", async () => {
    vi.spyOn(citizenApi, "exams").mockRejectedValue(new ApiError(403, "not_verified"));
    renderStep();
    expect(await screen.findByRole("note", { name: "cadastro não validado" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem exames: a frase de vazio", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page({ exams: [] }));
    renderStep();
    expect(await screen.findByText(EXAMS_EMPTY)).toBeInTheDocument();
  });

  it("campos ausentes: nada de undefined ou null", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page({ exams: [
      exam({ id: "e1", label: "Glicemia de jejum", status_label: "", requested_at: "",
        result: { available: true, pickup_at_unit: false, released_on: null, pdf_available: false } })
    ] }));
    renderStep();
    const item = await screen.findByRole("listitem", { name: "Glicemia de jejum" });
    expect(within(item).getByText("Resultado disponível")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
    expect(within(item).queryByText(/Pedido em/)).not.toBeInTheDocument();
  });

  it("interruptor desligado (403 feature_disabled): a frase dos exames", async () => {
    vi.spyOn(citizenApi, "exams").mockRejectedValue(new ApiError(403, "feature_disabled"));
    renderStep();
    expect((await screen.findByRole("alert")).textContent).toBe(EXAMS_DISABLED);
  });

  it("baixar o resultado: arquivo exame-<id>.pdf e o endereço revogado depois", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    const blob = new Blob([ "%PDF-1.7" ], { type: "application/pdf" });
    const pdf = vi.spyOn(citizenApi, "examPdf").mockResolvedValue(blob);
    const { createObjectURL, revokeObjectURL } = fakeBlobUrl();
    // O mock só guarda o que viu: um expect aqui dentro seria engolido pelo try do download.
    const seen: { download: string; href: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ download: this.download, href: this.href });
    });
    renderStep();
    const imm = await screen.findByRole("listitem", { name: "Hemograma completo" });
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: [ "Date", "setTimeout", "clearTimeout" ], shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-13T10:00:00-03:00"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(imm).getByRole("button", { name: "Baixar resultado de Hemograma completo" }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(pdf).toHaveBeenCalledWith("ex-imm", "p1");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(seen).toEqual([ { download: "exame-ex-imm.pdf", href: "blob:http://curitiba.localhost/abc" } ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://curitiba.localhost/abc");
  });

  it("resultado que deixou de estar disponível (404): diz no cartão e não baixa", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    vi.spyOn(citizenApi, "examPdf").mockRejectedValue(new ApiError(404, "not_found"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    renderStep();
    const imm = await screen.findByRole("listitem", { name: "Hemograma completo" });
    await userEvent.click(within(imm).getByRole("button", { name: "Baixar resultado de Hemograma completo" }));
    expect((await within(imm).findByRole("alert")).textContent).toBe(EXAM_PDF_GONE);
    expect(click).not.toHaveBeenCalled();
  });

  it("limite de downloads (429): a frase do download, não a do SMS", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    vi.spyOn(citizenApi, "examPdf").mockRejectedValue(new ApiError(429, "too_many_requests"));
    renderStep();
    const imm = await screen.findByRole("listitem", { name: "Hemograma completo" });
    await userEvent.click(within(imm).getByRole("button", { name: "Baixar resultado de Hemograma completo" }));
    expect((await within(imm).findByRole("alert")).textContent).toBe(PDF_RATE_LIMITED);
  });

  it("sair da tela durante o download: não cria o endereço nem clica", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    let resolve: (b: Blob) => void = () => {};
    vi.spyOn(citizenApi, "examPdf").mockImplementation(() => new Promise<Blob>((r) => { resolve = r; }));
    const { createObjectURL } = fakeBlobUrl("blob:http://curitiba.localhost/late");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { unmount } = renderStep();
    const imm = await screen.findByRole("listitem", { name: "Hemograma completo" });
    await userEvent.click(within(imm).getByRole("button", { name: "Baixar resultado de Hemograma completo" }));
    unmount();
    resolve(new Blob([ "%PDF" ], { type: "application/pdf" }));
    await Promise.resolve();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("carregar mais: cursor como veio, sem repetir; a falha aparece junto do botão", async () => {
    const spy = vi.spyOn(citizenApi, "exams")
      .mockResolvedValueOnce(page({ exams: [ IMMEDIATE, AFTER_ACK ], next_before: "2026-10-01T09:00:00-03:00|ex-ack" }))
      .mockRejectedValueOnce(new ApiError(500, "http_500"))
      .mockResolvedValueOnce(page({ exams: [ AFTER_ACK, NEVER ], next_before: null }));
    renderStep();
    await screen.findByRole("listitem", { name: "Hemoglobina glicada" });

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith("p1", { before: "2026-10-01T09:00:00-03:00|ex-ack" });

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("listitem", { name: "Sorologia para HIV" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label")))
      .toEqual([ "Hemograma completo", "Hemoglobina glicada", "Sorologia para HIV" ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("Voltar", async () => {
    vi.spyOn(citizenApi, "exams").mockResolvedValue(page());
    const onBack = vi.fn();
    renderStep(vi.fn(), onBack);
    await screen.findByRole("listitem", { name: "Hemograma completo" });
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });
});
