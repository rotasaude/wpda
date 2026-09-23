import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionStep } from "./QuestionStep";
import { HistoryStep } from "./HistoryStep";
import { citizenApi, ApiError, type Step } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const boolStep: Step = {
  triage_id: "t1", step_id: "tosse", prompt: "Você está com tosse?", answer_type: "boolean",
  options: [{ id: "true", title: "Sim" }, { id: "false", title: "Não" }], index: 1, total: 2, can_undo: false
};

describe("QuestionStep", () => {
  it("mostra progresso e manda o id da opção com uma chave de idempotência", async () => {
    const spy = vi.spyOn(citizenApi, "answer").mockResolvedValue({ status: "in_progress", step: { ...boolStep, index: 2 } });
    const onStep = vi.fn();
    render(<QuestionStep conversationId="c1" step={boolStep} onStep={onStep} onCompleted={vi.fn()} />);
    expect(screen.getByText("Pergunta 1 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(spy).toHaveBeenCalledWith("c1", "true", expect.any(String));
    expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ index: 2 }));
  });

  it("enum com muitas opções mostra todas", () => {
    const options = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, title: `Opção ${i}` }));
    render(<QuestionStep conversationId="c1" step={{ ...boolStep, answer_type: "enum", options }}
      onStep={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /Opção/ })).toHaveLength(12);
  });

  it("número usa teclado numérico e envia o valor", async () => {
    const spy = vi.spyOn(citizenApi, "answer").mockResolvedValue({ status: "completed", triage_id: "t1" });
    const onCompleted = vi.fn();
    render(<QuestionStep conversationId="c1" step={{ ...boolStep, answer_type: "integer", options: [], prompt: "Há quantos dias?" }}
      onStep={vi.fn()} onCompleted={onCompleted} />);
    await userEvent.type(screen.getByLabelText("Há quantos dias?"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(spy).toHaveBeenCalledWith("c1", "3", expect.any(String));
    expect(onCompleted).toHaveBeenCalledWith("t1");
  });

  it("voltar chama undo", async () => {
    const spy = vi.spyOn(citizenApi, "undo").mockResolvedValue({ status: "in_progress", step: boolStep });
    render(<QuestionStep conversationId="c1" step={{ ...boolStep, can_undo: true }} onStep={vi.fn()} onCompleted={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(spy).toHaveBeenCalledWith("c1");
  });

  it("resposta recusada mostra erro e mantém a pergunta", async () => {
    vi.spyOn(citizenApi, "answer").mockRejectedValue(new ApiError(422, "invalid_answer"));
    render(<QuestionStep conversationId="c1" step={boolStep} onStep={vi.fn()} onCompleted={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(await screen.findByText("Não entendemos a resposta. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByText("Você está com tosse?")).toBeInTheDocument();
  });
});

describe("HistoryStep", () => {
  it("lista triagens e avisa que o cadastro não é verificado", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" },
      triages: [{ id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
                  completed_at: "2026-09-22T12:05:00Z", report_url: "http://x/wpda/?token=abc", consent_active: true }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} />);
    expect(await screen.findByText(/Cadastro não verificado/)).toBeInTheDocument();
    expect(screen.getByText(/Prioridade alta/)).toBeInTheDocument();
  });
});
