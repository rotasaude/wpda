import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type Step } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const boolStep: Step = {
  triage_id: "t1", step_id: "tosse", prompt: "Você está com tosse?", answer_type: "boolean",
  options: [{ id: "true", title: "Sim" }, { id: "false", title: "Não" }], index: 1, total: 2, can_undo: true
};

async function reachQuestionStep() {
  vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({
    people: [{ id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }]
  });
  vi.spyOn(citizenApi, "start").mockResolvedValue({
    conversation_id: "c1", citizen_id: "p1", resumed: false, step: boolStep
  });
  render(<Flow />);
  await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
  await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
  expect(await screen.findByText("Você está com tosse?")).toBeInTheDocument();
}

describe("Flow", () => {
  it("sem sessão, começa pelo telefone", async () => {
    vi.spyOn(citizenApi, "currentSession").mockRejectedValue(new ApiError(401, "unauthenticated"));
    render(<Flow />);
    expect(await screen.findByLabelText("Seu celular")).toBeInTheDocument();
  });

  it("com sessão, vai direto ao termo", async () => {
    vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
    render(<Flow />);
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("sessão expirada (evento citizen:unauthenticated) volta para o telefone", async () => {
    vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
    render(<Flow />);
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("citizen:unauthenticated")));

    expect(await screen.findByLabelText("Seu celular")).toBeInTheDocument();
  });

  it("no_consent ao responder manda de volta para o termo de consentimento", async () => {
    await reachQuestionStep();
    vi.spyOn(citizenApi, "answer").mockRejectedValue(new ApiError(409, "no_consent"));

    await userEvent.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("consent_outdated ao voltar manda de volta para o termo de consentimento", async () => {
    await reachQuestionStep();
    vi.spyOn(citizenApi, "undo").mockRejectedValue(new ApiError(409, "consent_outdated"));

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("not_in_progress ao responder manda para a escolha de pessoa (retomada)", async () => {
    await reachQuestionStep();
    vi.spyOn(citizenApi, "answer").mockRejectedValue(new ApiError(409, "not_in_progress"));

    await userEvent.click(screen.getByRole("button", { name: "Sim" }));

    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
  });

  // Harness que força Flow a re-renderizar sem mudar seu estado interno —
  // simula o re-render que, sem useCallback, geraria um `issue` novo e
  // reemitiria o código de check-in (mesmo cuidado que VerificationCodeStep).
  function ForcedRerenderHarness() {
    const [tick, setTick] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setTick(t => t + 1)}>rerender {tick}</button>
        <Flow />
      </>
    );
  }

  it("issue do check-in é memoizado: re-render de Flow não reemite o código", async () => {
    vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
    vi.spyOn(citizenApi, "people").mockResolvedValue({
      people: [{ id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }]
    });
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" },
      triages: [{
        id: "t1", status: "completed", priority: 3, created_at: "2026-09-24T12:00:00Z",
        completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
        origin_phone_masked: null, tier: "azul", check_in_available: true
      }]
    });
    const issueCheckInCode = vi.spyOn(citizenApi, "issueCheckInCode")
      .mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() + 600000).toISOString() });

    render(<ForcedRerenderHarness />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await userEvent.click(await screen.findByText("Ver triagens de ***.982.247-**"));
    await userEvent.click(await screen.findByRole("button", { name: "Cheguei na unidade" }));

    expect(await screen.findByText("123456")).toBeInTheDocument();
    expect(issueCheckInCode).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /rerender/ }));

    expect(issueCheckInCode).toHaveBeenCalledTimes(1);
  });
});
