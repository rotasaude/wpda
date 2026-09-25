import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
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
  // Por padrão, sem agendamentos: quem quiser testar "Seus agendamentos"
  // sobrescreve com seu próprio mock antes de renderizar.
  beforeEach(() => {
    vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments: [] });
  });

  it("lista triagens e avisa que o cadastro não é verificado", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t1", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-22T12:00:00Z",
                  completed_at: "2026-09-22T12:05:00Z", report_url: "http://x/wpda/?token=abc", consent_active: true,
                  origin_phone_masked: null }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText(/Cadastro não verificado/)).toBeInTheDocument();
    expect(screen.getByText(/Prioridade alta/)).toBeInTheDocument();
  });

  it("cadastro declarado oferece 'Validar no posto'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: []
    });
    const onValidate = vi.fn();
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={onValidate} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Validar no posto" }));
    expect(onValidate).toHaveBeenCalledWith("p1");
  });

  it("cadastro verificado mostra o selo e a origem das triagens de outro celular, sem revogar", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", verified_at: "2026-09-24T12:00:00Z" },
      triages: [{ id: "t2", status: "completed", tier: "baixa", priority: 9, created_at: "2026-09-20T12:00:00Z",
                  completed_at: "2026-09-20T12:05:00Z", report_url: null, consent_active: false,
                  origin_phone_masked: "(**) *****-2222" }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText(/Cadastro verificado em/)).toBeInTheDocument();
    expect(screen.getByText("Feita no celular (**) *****-2222")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validar no posto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar consentimento" })).not.toBeInTheDocument();
  });

  it("triagem elegível para check-in mostra 'Cheguei na unidade' e chama onCheckIn(id)", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t3", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-23T12:00:00Z",
                  completed_at: "2026-09-23T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, attendance: null, check_in_available: true }]
    });
    const onCheckIn = vi.fn();
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={onCheckIn} onAppointmentCheckIn={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cheguei na unidade" }));
    expect(onCheckIn).toHaveBeenCalledWith("t3");
  });

  it("atendimento 'waiting' mostra 'Aguardando atendimento na UBS Centro'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t4w", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "waiting", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    called_at: null, request_kind: null, outcome: null, referral_unit_name: null, referral_note: null, closed_at: null } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Aguardando atendimento na UBS Centro")).toBeInTheDocument();
  });

  it("atendimento 'in_care' mostra 'Em atendimento na UBS Centro desde hh:mm' (hora de called_at)", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t4", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "in_care", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:00:00Z",
                    called_at: "2026-09-24T15:30:00Z", request_kind: null,
                    outcome: null, referral_unit_name: null, referral_note: null, closed_at: null } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText(/Em atendimento na UBS Centro desde \d\d:\d\d/)).toBeInTheDocument();
  });

  it("atendimento encerrado com alta mostra 'Atendido e liberado'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t5", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "closed", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    outcome: "discharged", referral_unit_name: null, referral_note: null, closed_at: "2026-09-24T16:00:00Z" } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Atendido e liberado")).toBeInTheDocument();
  });

  it("atendimento encerrado com encaminhamento (unidade e descrição) mostra 'Encaminhado para UPA Norte — cardiologia'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t6", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "closed", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    outcome: "referred", referral_unit_name: "UPA Norte", referral_note: "cardiologia", closed_at: "2026-09-24T16:00:00Z" } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Encaminhado para UPA Norte — cardiologia")).toBeInTheDocument();
  });

  it("atendimento encerrado com encaminhamento só com descrição mostra 'Encaminhado — só a nota'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t7", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "closed", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    outcome: "referred", referral_unit_name: null, referral_note: "só a nota", closed_at: "2026-09-24T16:00:00Z" } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Encaminhado — só a nota")).toBeInTheDocument();
  });

  it("atendimento encerrado com desfecho retorno mostra 'Retorno — veja em Seus agendamentos'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t6b", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "closed", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    outcome: "return", referral_unit_name: null, referral_note: null, closed_at: "2026-09-24T16:00:00Z" } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Retorno — veja em Seus agendamentos")).toBeInTheDocument();
  });

  it("atendimento encerrado com saída sem atendimento mostra 'Saiu sem atendimento'", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t8", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false,
                  attendance: { status: "closed", unit_name: "UBS Centro", checked_in_at: "2026-09-24T15:30:00Z",
                    outcome: "left", referral_unit_name: null, referral_note: null, closed_at: "2026-09-24T16:00:00Z" } }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    expect(await screen.findByText("Saiu sem atendimento")).toBeInTheDocument();
  });

  it("sem check_in_available nem atendimento, não mostra botão de check-in nem status de atendimento", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t9", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-10T12:00:00Z",
                  completed_at: "2026-09-10T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false, attendance: null }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    await screen.findByText(/Prioridade alta/);
    expect(screen.queryByRole("button", { name: "Cheguei na unidade" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Em atendimento/)).not.toBeInTheDocument();
  });

  it("'Seus agendamentos' aparece acima de 'Minhas triagens' quando há pedidos", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: [{ id: "t10", status: "completed", tier: "alta", priority: 1, created_at: "2026-09-24T12:00:00Z",
                  completed_at: "2026-09-24T12:05:00Z", report_url: null, consent_active: true,
                  origin_phone_masked: null, check_in_available: false, attendance: null }]
    });
    vi.spyOn(citizenApi, "appointments").mockResolvedValue({
      appointments: [{
        request: { id: "r1", kind: "return", target_unit_name: "UBS Centro", status: "open", closed_reason: null, reopened_reason: null },
        appointment: null
      }]
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    const cpfLine = await screen.findByText(/^CPF /);
    const heading = screen.getByRole("heading", { name: "Seus agendamentos" });
    // A seção de agendamentos vem antes da lista de triagens (CPF + itens),
    // não do título da página (o h1 "Minhas triagens" do cabeçalho).
    expect(heading.compareDocumentPosition(cpfLine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sem pedidos, 'Seus agendamentos' não aparece", async () => {
    vi.spyOn(citizenApi, "triages").mockResolvedValue({
      citizen: { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", verified_at: null },
      triages: []
    });
    render(<HistoryStep citizenId="p1" onBack={vi.fn()} onValidate={vi.fn()} onCheckIn={vi.fn()} onAppointmentCheckIn={vi.fn()} />);
    await screen.findByText(/Cadastro não verificado/);
    expect(screen.queryByRole("heading", { name: "Seus agendamentos" })).not.toBeInTheDocument();
  });
});
