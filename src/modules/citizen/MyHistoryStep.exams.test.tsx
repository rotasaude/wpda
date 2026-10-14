// src/modules/citizen/MyHistoryStep.exams.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyHistoryStep } from "./MyHistoryStep";
import { citizenApi, ApiError, type CitizenEntry, type CitizenHistory } from "../../lib/citizenApi";
import { EXAM_PDF_GONE } from "../../lib/exams";
import { DOCUMENT_GONE } from "../../lib/history";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-13T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const EXAM: CitizenEntry = {
  id: "exam:ex1", kind: "exam", occurred_at: "2026-10-08T10:00:00-03:00", unit: { name: "UBS Centro" },
  professional_name: null, title: "Hemograma completo", summary: null, status: "scheduled",
  status_label: "Resultado disponível",
  document: { id: "ex1", short_code: null, verification_url: null, downloadable: true }
};
const EXAM_NO_PDF: CitizenEntry = { ...EXAM, id: "exam:ex2", title: "Hemoglobina glicada", status_label: "Coletado", document: null };
const DOC: CitizenEntry = {
  id: "clinical_document:doc2", kind: "clinical_document", occurred_at: "2026-09-10T14:40:00-03:00", unit: null,
  professional_name: null, title: "Receita", summary: null, status: "issued",
  document: { id: "doc2", short_code: "P3H8T-2LQ6R", verification_url: null, downloadable: true }
};

function api(entries: CitizenEntry[]) {
  const timeline: CitizenHistory = { verified: true, partial: false, entries, next_before: null };
  vi.spyOn(citizenApi, "history").mockImplementation(async (_id, o = {}) =>
    (o.kinds?.length ? { ...timeline, entries: [ DOC ] } : timeline));
  vi.spyOn(citizenApi, "healthSummary").mockRejectedValue(new ApiError(404, "not_available"));
}

const renderStep = () => render(<MyHistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} />);

describe("MyHistoryStep — exames (módulo 21a)", () => {
  it("exame na linha do tempo: rótulo, situação e PDF pela rota do exame", async () => {
    api([ EXAM, EXAM_NO_PDF, DOC ]);
    const examPdf = vi.spyOn(citizenApi, "examPdf").mockResolvedValue(new Blob([ "%PDF" ], { type: "application/pdf" }));
    const documentPdf = vi.spyOn(citizenApi, "documentPdf");
    class FakeURL extends URL {}
    Object.assign(FakeURL, { createObjectURL: vi.fn(() => "blob:http://curitiba.localhost/ex"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("URL", FakeURL);
    const seen: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { seen.push(this.download); });
    const { unmount } = renderStep();

    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    expect(within(timeline).getAllByText("Exame")).toHaveLength(2);
    expect(within(timeline).getByText("Resultado disponível")).toBeInTheDocument();
    expect(within(timeline).getByText("Coletado")).toBeInTheDocument();
    // status_label vence o código: "scheduled" não vira "marcado".
    expect(within(timeline).queryByText("marcado")).not.toBeInTheDocument();
    // Só o documento tem código de conferência; o exame não.
    expect(within(timeline).getAllByText(/Código de conferência/)).toHaveLength(1);

    await userEvent.click(within(timeline).getByRole("button", { name: "Baixar PDF de Hemograma completo" }));
    await vi.waitFor(() => expect(seen).toEqual([ "exame-ex1.pdf" ]));
    expect(examPdf).toHaveBeenCalledWith("ex1", "p1");
    expect(documentPdf).not.toHaveBeenCalled();
    expect(within(timeline).queryByRole("button", { name: "Baixar PDF de Hemoglobina glicada" })).not.toBeInTheDocument();
    unmount(); // revoga o blob enquanto o URL dublê ainda está no global
  });

  it("exame que sumiu na linha do tempo: a frase do exame, não a do documento", async () => {
    api([ EXAM ]);
    vi.spyOn(citizenApi, "examPdf").mockRejectedValue(new ApiError(404, "not_found"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    renderStep();
    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    await userEvent.click(within(timeline).getByRole("button", { name: "Baixar PDF de Hemograma completo" }));
    expect((await within(timeline).findByRole("alert")).textContent).toBe(EXAM_PDF_GONE);
    expect(within(timeline).queryByText(DOCUMENT_GONE)).not.toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });

  it("documento segue pela rota de documentos", async () => {
    api([ DOC ]);
    const documentPdf = vi.spyOn(citizenApi, "documentPdf").mockRejectedValue(new ApiError(404, "not_found"));
    const examPdf = vi.spyOn(citizenApi, "examPdf");
    renderStep();
    const timeline = await screen.findByRole("region", { name: "Linha do tempo" });
    await userEvent.click(within(timeline).getByRole("button", { name: "Baixar PDF de Receita" }));
    expect((await within(timeline).findByRole("alert")).textContent).toBe(DOCUMENT_GONE);
    expect(documentPdf).toHaveBeenCalledWith("doc2", "p1");
    expect(examPdf).not.toHaveBeenCalled();
  });
});
