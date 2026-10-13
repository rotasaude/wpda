// Saída na primeira pergunta (WP-12).
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionStep } from "./QuestionStep";
import type { Step } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const step: Step = {
  triage_id: "t1", step_id: "q1", prompt: "Você caiu?", answer_type: "boolean",
  options: [ { id: "true", title: "Sim" }, { id: "false", title: "Não" } ], index: 1, total: 3, can_undo: false
};

describe("QuestionStep (WP-12)", () => {
  it("na primeira pergunta oferece escolher outra triagem", async () => {
    const onLeave = vi.fn();
    render(<QuestionStep conversationId="c1" step={step} onStep={vi.fn()} onCompleted={vi.fn()} onLeave={onLeave} />);
    const leave = screen.getByRole("button", { name: "Escolher outra triagem" });
    expect(leave.style.background).toBe("transparent");
    await userEvent.click(leave);
    expect(onLeave).toHaveBeenCalled();
  });

  it("com Voltar disponível, não mostra a saída", () => {
    render(<QuestionStep conversationId="c1" step={{ ...step, index: 2, can_undo: true }} onStep={vi.fn()}
      onCompleted={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Escolher outra triagem" })).toBeNull();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });
});
