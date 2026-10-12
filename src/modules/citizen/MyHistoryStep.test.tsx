// src/modules/citizen/MyHistoryStep.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyHistoryStep } from "./MyHistoryStep";
import { citizenApi, ApiError, type CitizenEntry, type CitizenHistory, type HealthSummary } from "../../lib/citizenApi";
import { DOCUMENT_GONE, NOT_VERIFIED_INVITE, PARTIAL_NOTICE } from "../../lib/history";
import { PDF_RATE_LIMITED } from "./ui";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-11T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const entry = (over: Partial<CitizenEntry>): CitizenEntry => ({
  id: "x", kind: "triage", occurred_at: "2026-09-09T20:15:00-03:00", unit: null, professional_name: null,
  title: "", summary: null, status: null, document: null, ...over
});
const APPOINTMENT = entry({ id: "appointment:ap1", kind: "appointment", occurred_at: "2026-10-01T09:00:00-03:00",
  unit: { name: "UBS Centro" }, professional_name: "Enf. Lúcia Prado", title: "Retorno — Consulta de enfermagem", status: "confirmed" });
const DOCUMENT = entry({ id: "clinical_document:doc2", kind: "clinical_document", occurred_at: "2026-09-10T14:40:00-03:00",
  unit: { name: "UBS Centro" }, professional_name: "Dra. Helena Prado", title: "Receita", status: "issued",
  document: { id: "doc2", short_code: "P3H8T-2LQ6R", verification_url: "https://curitiba.rotasaude.app/v/tok2", downloadable: true } });
const CONSULTATION = entry({ id: "consultation:cs0", kind: "consultation", occurred_at: "2026-09-10T14:30:00-03:00",
  unit: { name: "UBS Centro" }, title: "Consulta com Dra. Helena Prado" });
const TRIAGE = entry({ id: "triage:tr1", title: "Triagem respiratória", summary: "prioridade 2" });

const history = (over: Partial<CitizenHistory> = {}): CitizenHistory =>
  ({ verified: true, partial: false, entries: [ APPOINTMENT, DOCUMENT, CONSULTATION, TRIAGE ], next_before: null, ...over });
const SUMMARY: HealthSummary = {
  problems: [ { terminology: "ciap2", code: "T90", label: "Diabetes", since: "2019-03-01" } ],
  medications: [ { label: "Metformina 850 mg", dosage_summary: "1 comprimido 2 vezes ao dia", since: null } ],
  exam_requests: [ { sigtap_code: "0202010503", label: "Hemoglobina glicada", requested_at: "2026-09-10T14:30:00-03:00" } ],
  vitals: { blood_pressure: { systolic: 130, diastolic: 85, measured_at: "2026-09-10T14:30:00-03:00" } }
};

function api(opts: { timeline?: CitizenHistory; documents?: CitizenHistory; summary?: HealthSummary | ApiError } = {}) {
  const historySpy = vi.spyOn(citizenApi, "history").mockImplementation(async (_id, o = {}) =>
    (o.kinds?.length ? (opts.documents ?? history({ entries: [ DOCUMENT ] })) : (opts.timeline ?? history())));
  const summary = opts.summary ?? SUMMARY;
  const summarySpy = vi.spyOn(citizenApi, "healthSummary").mockImplementation(async () => {
    if (summary instanceof ApiError) throw summary;
    return summary;
  });
  return { historySpy, summarySpy };
}

const renderStep = (onValidate = vi.fn(), onBack = vi.fn()) =>
  render(<MyHistoryStep citizenId="p1" onBack={onBack} onValidate={onValidate} />);

describe("MyHistoryStep", () => {
  it("par validado: resumo, documentos e linha do tempo", async () => {
    const { historySpy, summarySpy } = api();
    renderStep();

    const summary = await screen.findByRole("region", { name: "Resumo de saúde" });
    expect(within(summary).getByText("Diabetes")).toBeInTheDocument();
    expect(within(summary).getByText("desde 01/03/2019")).toBeInTheDocument();
    expect(within(summary).getByText("Metformina 850 mg — 1 comprimido 2 vezes ao dia")).toBeInTheDocument();
    expect(within(summary).getByText("Hemoglobina glicada — pedido em 10/09/2026")).toBeInTheDocument();
    expect(within(summary).getByText("Pressão: 130/85 mmHg — 10/09/2026")).toBeInTheDocument();

    const docs = await screen.findByRole("region", { name: "Documentos" });
    expect(within(docs).getByText("Receita")).toBeInTheDocument();
    expect(within(docs).getByText("Código de conferência: P3H8T-2LQ6R")).toBeInTheDocument();
    expect(within(docs).getByRole("link", { name: "Conferir o documento P3H8T-2LQ6R" }))
      .toHaveAttribute("href", "https://curitiba.rotasaude.app/v/tok2");
    expect(within(docs).getByRole("button", { name: "Baixar PDF de Receita" })).toBeInTheDocument();

    const timeline = screen.getByRole("region", { name: "Linha do tempo" });
    const text = timeline.textContent ?? "";
    const order = [ "Retorno — Consulta de enfermagem", "Receita", "Consulta com Dra. Helena Prado", "Triagem respiratória" ]
      .map((t) => text.indexOf(t));
    expect([ ...order ].sort((a, b) => a - b)).toEqual(order);
    expect(within(timeline).getByText("Agendamento")).toBeInTheDocument();
    expect(within(timeline).getByText("UBS Centro · Enf. Lúcia Prado")).toBeInTheDocument();
    expect(within(timeline).getByText("01/10/2026, 09:00")).toBeInTheDocument();
    expect(within(timeline).getByText("confirmado")).toBeInTheDocument();
    expect(within(timeline).queryByText("confirmed")).not.toBeInTheDocument();

    expect(historySpy).toHaveBeenCalledWith("p1");
    expect(historySpy).toHaveBeenCalledWith("p1", { kinds: [ "clinical_document" ] });
    expect(summarySpy).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("note", { name: "histórico parcial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "cadastro não validado" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("par declarado: triagens e agendamentos, convite para validar e nada de resumo ou documentos", async () => {
    const onValidate = vi.fn();
    const { historySpy, summarySpy } = api({ timeline: history({ verified: false, entries: [ APPOINTMENT, TRIAGE ] }) });
    renderStep(onValidate);
    expect((await screen.findByRole("note", { name: "cadastro não validado" })).textContent).toBe(NOT_VERIFIED_INVITE);
    expect(screen.getByText("Triagem respiratória")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumo de saúde" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Documentos" })).not.toBeInTheDocument();
    expect(summarySpy).not.toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("resumo indisponível (404): sem a seção e sem erro", async () => {
    api({ summary: new ApiError(404, "not_available") });
    renderStep();
    expect(await screen.findByRole("region", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumo de saúde" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resumo com listas vazias: as frases de vazio", async () => {
    api({ summary: { problems: [], medications: [], exam_requests: [], vitals: {} } });
    renderStep();
    const summary = await screen.findByRole("region", { name: "Resumo de saúde" });
    expect(within(summary).getByText("Nenhum problema de saúde ativo registrado.")).toBeInTheDocument();
    expect(within(summary).getByText("Nenhuma medida registrada.")).toBeInTheDocument();
  });

  it("histórico parcial: o aviso", async () => {
    api({ timeline: history({ partial: true }) });
    renderStep();
    expect((await screen.findByRole("note", { name: "histórico parcial" })).textContent).toBe(PARTIAL_NOTICE);
  });

  it("carregar mais: cursor como veio e sem repetir", async () => {
    const historySpy = vi.spyOn(citizenApi, "history").mockImplementation(async (_id, o = {}) => {
      if (o.kinds?.length) return history({ entries: [] });
      return o.before
        ? history({ entries: [ DOCUMENT, CONSULTATION ], next_before: null })
        : history({ entries: [ APPOINTMENT, DOCUMENT ], next_before: "2026-09-10T14:40:00-03:00|clinical_document|doc2" });
    });
    vi.spyOn(citizenApi, "healthSummary").mockResolvedValue(SUMMARY);
    renderStep();
    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    await userEvent.click(await within(timeline).findByRole("button", { name: "Carregar mais" }));
    expect(await within(timeline).findByText("Consulta com Dra. Helena Prado")).toBeInTheDocument();
    expect(historySpy).toHaveBeenLastCalledWith("p1", { before: "2026-09-10T14:40:00-03:00|clinical_document|doc2" });
    expect(within(timeline).getAllByText("Receita")).toHaveLength(1);
    expect(within(timeline).queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("baixar o PDF: arquivo com o código", async () => {
    api();
    const blob = new Blob([ "%PDF-1.7" ], { type: "application/pdf" });
    const pdf = vi.spyOn(citizenApi, "documentPdf").mockResolvedValue(blob);
    const createObjectURL = vi.fn(() => "blob:http://curitiba.localhost/abc");
    const revokeObjectURL = vi.fn();
    // O jsdom não tem createObjectURL/revokeObjectURL: um URL dublê no global, desfeito pelo unstubAllGlobals.
    class FakeURL extends URL {}
    Object.assign(FakeURL, { createObjectURL, revokeObjectURL });
    vi.stubGlobal("URL", FakeURL);
    // O mock só guarda o que viu: um expect aqui dentro seria engolido pelo try do download.
    const seen: { download: string; href: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ download: this.download, href: this.href });
    });
    renderStep();
    const docs = await screen.findByRole("region", { name: "Documentos" });
    // Daqui em diante o setTimeout também é falso, para conferir a revogação do blob.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: [ "Date", "setTimeout", "clearTimeout" ], shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-11T10:00:00-03:00"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(docs).getByRole("button", { name: "Baixar PDF de Receita" }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(pdf).toHaveBeenCalledWith("doc2");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(seen).toEqual([ { download: "documento-P3H8T-2LQ6R.pdf", href: "blob:http://curitiba.localhost/abc" } ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://curitiba.localhost/abc");
  });

  it("baixar o PDF com limite estourado (429): a frase do download, não a do SMS", async () => {
    api();
    vi.spyOn(citizenApi, "documentPdf").mockRejectedValue(new ApiError(429, "too_many_requests"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    renderStep();
    const docs = await screen.findByRole("region", { name: "Documentos" });
    await userEvent.click(within(docs).getByRole("button", { name: "Baixar PDF de Receita" }));
    expect(await within(docs).findByRole("alert")).toHaveTextContent(PDF_RATE_LIMITED);
    expect(screen.queryByText("Muitas tentativas. Aguarde um pouco e tente de novo.")).not.toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });

  it("baixar pela linha do tempo e falhar: o erro aparece na própria linha do tempo", async () => {
    api();
    vi.spyOn(citizenApi, "documentPdf").mockRejectedValue(new ApiError(404, "not_found"));
    renderStep();
    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    await screen.findByRole("region", { name: "Documentos" });
    await userEvent.click(within(timeline).getByRole("button", { name: "Baixar PDF de Receita" }));
    expect(await within(timeline).findByText(DOCUMENT_GONE)).toBeInTheDocument();
  });

  it("documento que sumiu: diz e não baixa", async () => {
    api();
    vi.spyOn(citizenApi, "documentPdf").mockRejectedValue(new ApiError(404, "not_found"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    renderStep();
    const docs = await screen.findByRole("region", { name: "Documentos" });
    await userEvent.click(within(docs).getByRole("button", { name: "Baixar PDF de Receita" }));
    expect(await screen.findByText(DOCUMENT_GONE)).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });

  it("baixando: o nome acessível do botão diz Baixando", async () => {
    api();
    vi.spyOn(citizenApi, "documentPdf").mockImplementation(() => new Promise<Blob>(() => {}));
    renderStep();
    const docs = await screen.findByRole("region", { name: "Documentos" });
    await userEvent.click(within(docs).getByRole("button", { name: "Baixar PDF de Receita" }));
    const busy = await within(docs).findByRole("button", { name: "Baixando PDF de Receita" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveTextContent("Baixando…");
  });

  it("documento sem PDF (downloadable false): só o código, sem botão", async () => {
    api({ documents: history({ entries: [ { ...DOCUMENT, document: { ...DOCUMENT.document!, downloadable: false } } ] }) });
    renderStep();
    const docs = await screen.findByRole("region", { name: "Documentos" });
    expect(within(docs).getByText("Código de conferência: P3H8T-2LQ6R")).toBeInTheDocument();
    expect(within(docs).queryByRole("button", { name: /Baixar PDF/ })).not.toBeInTheDocument();
  });

  it("tipo desconhecido vira Registro", async () => {
    api({ timeline: history({ entries: [ entry({ id: "vaccination:v1", kind: "vaccination", title: "Vacina contra a gripe" }) ] }) });
    renderStep();
    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    expect(within(timeline).getByText("Registro")).toBeInTheDocument();
    expect(within(timeline).queryByText("vaccination")).not.toBeInTheDocument();
  });

  it("interruptor desligado no meio: a frase", async () => {
    vi.spyOn(citizenApi, "history").mockRejectedValue(new ApiError(403, "feature_disabled"));
    renderStep();
    expect(await screen.findByRole("alert")).toHaveTextContent("O histórico ainda não está disponível nesta cidade.");
  });

  it("Voltar", async () => {
    api();
    const onBack = vi.fn();
    renderStep(vi.fn(), onBack);
    await userEvent.click(await screen.findByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });
});
