// src/modules/citizen/MyManifestationsStep.test.tsx
// Módulo 33 (contrato §3, §10, §14; spec decisões 16 e 17; Q2, Q19, Q40, Q42, Q45): lista e detalhe das manifestações.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyManifestationsStep } from "./MyManifestationsStep";
import { ManifestationDetailStep } from "./ManifestationDetailStep";
import { citizenApi, ApiError, type CitizenManifestation, type CitizenManifestationSummary } from "../../lib/citizenApi";

beforeEach(() => { vi.useFakeTimers({ toFake: [ "Date" ] }); vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const ITEM: CitizenManifestationSummary = { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "preserved", state: "forwarded",
  received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "green", cpf_masked: "***.982.247-**", has_unread: true };
const DETAIL: CitizenManifestation = { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "identified",
  state: "awaiting_complement", received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "paused", body: "Esperei quatro horas.",
  health_unit: { id: "u1", name: "UBS Centro" }, attachments: [ { id: "a1" } ],
  timeline: [ { kind: "received", at: "2026-11-10T09:00:00-03:00", text: null },
    { kind: "complement_requested", at: "2026-11-11T09:00:00-03:00", text: "Em que horário foi?" } ],
  can_complement: true, can_request_reopen: false, can_answer_satisfaction: false };
const opts = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
type User = ReturnType<typeof opts>;

const LONG = "Texto com mais de vinte caracteres aqui.";
const form = () => screen.getByRole("region", { name: "Enviar complemento" });

async function openAndType(user: User, open: string, field: string, text: string) {
  await user.click(await screen.findByRole("button", { name: open }));
  await user.click(screen.getByRole("textbox", { name: field }));
  await user.paste(text);
}

describe("MyManifestationsStep", () => {
  it("lista: tipo, protocolo, Em análise (nunca encaminhada), prazo, preservada, CPF e novo", async () => {
    vi.spyOn(citizenApi, "manifestations").mockResolvedValue([ ITEM ]);
    const onOpen = vi.fn();
    const user = opts();
    render(<MyManifestationsStep onBack={vi.fn()} onNew={vi.fn()} onOpen={onOpen} />);
    expect(screen.getByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    const item = await screen.findByRole("button", { name: "Reclamação — protocolo 2026-000123" });
    for (const t of [ "Reclamação", "Protocolo 2026-000123", "Recebida em 10/11/2026", "Em análise", "Resposta prevista até 10/12/2026",
      "Identidade preservada", "Para o CPF ***.982.247-**", "novo" ])
      expect(within(item).getByText(t)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[Ee]ncaminha/);
    expect(screen.getByText(/Denúncias anônimas não aparecem aqui, porque não ficam ligadas a ninguém\./)).toBeInTheDocument();
    await user.click(item);
    expect(onOpen).toHaveBeenCalledWith("m1");
  });

  it("lista: identificada, sem CPF e já lida não mostram preservada, CPF nem novo; final sem prazo", async () => {
    vi.spyOn(citizenApi, "manifestations").mockResolvedValue([
      { ...ITEM, identification_mode: "identified", cpf_masked: null, has_unread: false, state: "answered", color: null }
    ]);
    render(<MyManifestationsStep onBack={vi.fn()} onNew={vi.fn()} onOpen={vi.fn()} />);
    const item = await screen.findByRole("button", { name: "Reclamação — protocolo 2026-000123" });
    expect(within(item).getByText("Respondida")).toBeInTheDocument();
    for (const t of [ /Identidade preservada/, /Para o CPF/, /^novo$/, /Resposta prevista/ ]) expect(within(item).queryByText(t)).toBeNull();
  });

  it("vazia: frase própria, nota do anônimo e Nova manifestação", async () => {
    vi.spyOn(citizenApi, "manifestations").mockResolvedValue([]);
    const onNew = vi.fn();
    const user = opts();
    render(<MyManifestationsStep onBack={vi.fn()} onNew={onNew} onOpen={vi.fn()} />);
    expect(await screen.findByText("Você ainda não fez nenhuma manifestação por aqui.")).toBeInTheDocument();
    expect(screen.getByText(/Denúncias anônimas não aparecem aqui/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nova manifestação" }));
    expect(onNew).toHaveBeenCalled();
  });

  it("rodapé: Denúncia anônima com onAnonymous, e Voltar", async () => {
    vi.spyOn(citizenApi, "manifestations").mockResolvedValue([]);
    const onAnonymous = vi.fn();
    const onBack = vi.fn();
    const user = opts();
    render(<MyManifestationsStep onBack={onBack} onNew={vi.fn()} onOpen={vi.fn()} onAnonymous={onAnonymous} />);
    await screen.findByText("Você ainda não fez nenhuma manifestação por aqui.");
    await user.click(screen.getByRole("button", { name: "Denúncia anônima" }));
    expect(onAnonymous).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("feature_disabled: frase da Ouvidoria, não a do histórico", async () => {
    vi.spyOn(citizenApi, "manifestations").mockRejectedValue(new ApiError(403, "feature_disabled"));
    render(<MyManifestationsStep onBack={vi.fn()} onNew={vi.fn()} onOpen={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("A Ouvidoria não está disponível agora nesta cidade.");
  });

  it("resposta depois de sair da tela é ignorada", async () => {
    let resolve!: (v: CitizenManifestationSummary[]) => void;
    vi.spyOn(citizenApi, "manifestations").mockReturnValue(new Promise((r) => { resolve = r; }));
    const { unmount } = render(<MyManifestationsStep onBack={vi.fn()} onNew={vi.fn()} onOpen={vi.fn()} />);
    unmount();
    await act(async () => { resolve([ ITEM ]); });
    expect(screen.queryByRole("button", { name: /protocolo/ })).toBeNull();
  });
});

describe("ManifestationDetailStep", () => {
  it("detalhe: texto, unidade, Anexo N e andamento; nada do encaminhamento nem nome de arquivo", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue({
      ...DETAIL, timeline: [ ...DETAIL.timeline, { kind: "complement_received", at: "2026-11-11T15:30:00-03:00", text: null } ]
    });
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Manifestação 2026-000123" })).toBeInTheDocument();
    for (const t of [ "Reclamação", "Aguardando seu complemento", "Esperei quatro horas.", "UBS Centro", "Anexo 1", "Manifestação recebida",
      "A Ouvidoria pediu um complemento", "Em que horário foi?", "Prazo suspenso até você enviar o complemento", "Complemento recebido",
      "11/11/2026, 15:30" ]) expect(screen.getByText(t)).toBeInTheDocument();
    const steps = within(screen.getByRole("list", { name: "Andamento" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[2].textContent).toBe("Complemento recebido11/11/2026, 15:30");
    expect(screen.getByText("Esperei quatro horas.")).toHaveStyle({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
    expect(document.body.textContent).not.toMatch(/[Ee]ncaminha|extrato|Atendimento/);
    expect(document.body.textContent).not.toMatch(/anexo-\d/);
  });

  it("prazo: usa a cor do detalhe (Q42) e o estado final não tem prazo", async () => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "in_analysis", color: "red", can_complement: false });
    const { unmount } = render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    expect(await screen.findByText("O prazo de resposta venceu em 10/12/2026")).toBeInTheDocument();
    unmount();
    get.mockResolvedValue({ ...DETAIL, state: "archived", color: null, can_complement: false });
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    expect(await screen.findByText("Arquivada")).toBeInTheDocument();
    expect(screen.queryByText(/[Pp]razo/)).toBeNull();
  });

  it("onRead: chamado uma vez depois da primeira leitura (Q45), não a cada releitura", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValueOnce(DETAIL).mockResolvedValueOnce({ ...DETAIL, state: "in_analysis", can_complement: false });
    vi.spyOn(citizenApi, "complementManifestation").mockResolvedValue(undefined);
    const onRead = vi.fn();
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} onRead={onRead} />);
    await screen.findByRole("heading", { level: 1, name: "Manifestação 2026-000123" });
    expect(onRead).toHaveBeenCalledTimes(1);
    await openAndType(user, "Enviar complemento", "Seu complemento", "Foi às 7h, na recepção.");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    await screen.findByRole("status");
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("404 not_found: frase própria e só Voltar às manifestações (Q19); onRead não é chamado", async () => {
    vi.spyOn(citizenApi, "manifestation").mockRejectedValue(new ApiError(404, "not_found"));
    const onBack = vi.fn();
    const onRead = vi.fn();
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={onBack} onRead={onRead} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta manifestação não está disponível por aqui.");
    expect(screen.getAllByRole("button").map(b => b.textContent)).toEqual([ "Voltar às manifestações" ]);
    await user.click(screen.getByRole("button", { name: "Voltar às manifestações" }));
    expect(onBack).toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();
  });

  it("resposta depois de sair da tela é ignorada", async () => {
    let resolve!: (v: CitizenManifestation) => void;
    vi.spyOn(citizenApi, "manifestation").mockReturnValue(new Promise((r) => { resolve = r; }));
    const onRead = vi.fn();
    const { unmount } = render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} onRead={onRead} />);
    unmount();
    await act(async () => { resolve(DETAIL); });
    expect(onRead).not.toHaveBeenCalled();
  });

  it("complemento: envia o texto aparado e relê", async () => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce({ ...DETAIL, state: "in_analysis", can_complement: false });
    const send = vi.spyOn(citizenApi, "complementManifestation").mockResolvedValue(undefined);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", "  Foi às 7h, na recepção da UBS Centro.  ");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(send).toHaveBeenCalledWith("m1", { body: "Foi às 7h, na recepção da UBS Centro.", attachmentIds: [] });
    expect(await screen.findByRole("status")).toHaveTextContent("Complemento enviado.");
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Enviar complemento" })).toBeNull();
  });

  it("complemento: de 10 a 4.000 (não 20); curto não envia", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue(DETAIL);
    const send = vi.spyOn(citizenApi, "complementManifestation").mockResolvedValue(undefined);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", "às 7h");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    const box = screen.getByRole("textbox", { name: "Seu complemento" });
    expect(box).toHaveAccessibleDescription(/pelo menos 10 caracteres/);
    expect(box).toHaveFocus();
    expect(screen.getByText("5 de 4.000")).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    await user.paste(", recepção");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(send).toHaveBeenCalledWith("m1", { body: "às 7h, recepção", attachmentIds: [] });
  });

  it("complemento: anexo subindo bloqueia o envio; depois vai com o id; anexos zerados ao reabrir", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue(DETAIL);
    const send = vi.spyOn(citizenApi, "complementManifestation").mockResolvedValue(undefined);
    let resolve!: (v: { id: string }) => void;
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", "Foi às 7h, na recepção.");
    await user.upload(screen.getByLabelText("Anexar arquivo (opcional)"), new File([ "%PDF-1" ], "laudo.pdf", { type: "application/pdf" }));
    await screen.findByText("Aguarde o anexo terminar de subir.");
    const submit = screen.getByRole("button", { name: "Enviar o complemento" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription("Aguarde o anexo terminar de subir.");
    await user.click(submit);
    expect(send).not.toHaveBeenCalled();
    await act(async () => { resolve({ id: "a1" }); });
    expect(await within(form()).findByText("Anexo 1")).toBeInTheDocument();
    expect(screen.queryByText(/laudo/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await openAndType(user, "Enviar complemento", "Seu complemento", "Foi às 7h, na recepção.");
    expect(within(form()).queryByText("Anexo 1")).toBeNull();
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockResolvedValueOnce({ id: "a2" });
    await user.upload(screen.getByLabelText("Anexar arquivo (opcional)"), new File([ "%PDF-1" ], "laudo.pdf", { type: "application/pdf" }));
    await within(form()).findByText("Anexo 1");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(send).toHaveBeenCalledWith("m1", { body: "Foi às 7h, na recepção.", attachmentIds: [ "a2" ] });
  });

  it("complemento: enquanto envia, nada sai de novo e Cancelar fica desligado", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue(DETAIL);
    let resolve!: () => void;
    const send = vi.spyOn(citizenApi, "complementManifestation").mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", "Foi às 7h, na recepção.");
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(screen.getByRole("button", { name: "Enviar o complemento" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); });
    expect(await screen.findByRole("status")).toHaveTextContent("Complemento enviado.");
  });

  it("pesquisa: as três perguntas do contrato; manda met, clear e score", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "answered", color: null, can_complement: false, can_answer_satisfaction: true });
    const answer = vi.spyOn(citizenApi, "answerSatisfaction").mockResolvedValue(undefined);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Responder a pesquisa" }));
    const met = screen.getByRole("group", { name: "Sua demanda foi atendida?" });
    expect(within(met).getAllByRole("radio").map(r => r.parentElement?.textContent)).toEqual([ "Sim", "Em parte", "Não" ]);
    const score = screen.getByRole("group", { name: "De 1 a 5, qual sua satisfação com a ouvidoria?" });
    expect(within(score).getAllByRole("radio").map(r => r.parentElement?.textContent))
      .toEqual([ "1 (muito insatisfeito)", "2", "3", "4", "5 (muito satisfeito)" ]);
    await user.click(within(met).getByRole("radio", { name: "Em parte" }));
    await user.click(within(screen.getByRole("group", { name: "A resposta foi fácil de entender?" })).getByRole("radio", { name: "Sim" }));
    await user.click(within(score).getByRole("radio", { name: /^4/ }));
    await user.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(answer).toHaveBeenCalledWith("m1", { met: "partly", clear: true, score: 4 });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("Obrigado por responder.");
  });

  it("pesquisa: sem as três respostas, erro no primeiro grupo vazio e nada sai; Não vira false", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "answered", color: null, can_complement: false, can_answer_satisfaction: true });
    const answer = vi.spyOn(citizenApi, "answerSatisfaction").mockResolvedValue(undefined);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Responder a pesquisa" }));
    await user.click(within(screen.getByRole("group", { name: "Sua demanda foi atendida?" })).getByRole("radio", { name: "Não" }));
    await user.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(screen.getByRole("group", { name: "A resposta foi fácil de entender?" })).toHaveAccessibleDescription("Responda as três perguntas.");
    expect(screen.getByRole("group", { name: "Sua demanda foi atendida?" })).not.toHaveAccessibleDescription("Responda as três perguntas.");
    expect(answer).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("group", { name: "A resposta foi fácil de entender?" })).getByRole("radio", { name: "Não" }));
    await user.click(within(screen.getByRole("group", { name: "De 1 a 5, qual sua satisfação com a ouvidoria?" })).getByRole("radio", { name: /^1/ }));
    await user.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(answer).toHaveBeenCalledWith("m1", { met: "no", clear: false, score: 1 });
  });

  it("reabertura: motivo de 10 a 2.000", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "answered", color: null, can_complement: false, can_request_reopen: true });
    const reopen = vi.spyOn(citizenApi, "requestReopen").mockResolvedValue(undefined);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Pedir reabertura", "Por que você quer reabrir?", "curto");
    await user.click(screen.getByRole("button", { name: "Enviar o pedido" }));
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(/pelo menos 10 caracteres/);
    await user.paste(" — a resposta não resolveu");
    await user.click(screen.getByRole("button", { name: "Enviar o pedido" }));
    expect(reopen).toHaveBeenCalledWith("m1", "curto — a resposta não resolveu");
    expect(await screen.findByRole("status")).toHaveTextContent("Pedido de reabertura enviado.");
  });

  it("uma ação por vez: abrir uma esconde as outras; Cancelar volta", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "answered", color: null, can_complement: false,
      can_request_reopen: true, can_answer_satisfaction: true });
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Pedir reabertura" }));
    expect(screen.queryByRole("button", { name: "Responder a pesquisa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pedir reabertura" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Pedir reabertura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Responder a pesquisa" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it.each([
    [ "complementManifestation", "Enviar complemento", "Seu complemento", "Enviar o complemento", new ApiError(409, "manifestation_changed"), "A manifestação mudou. Veja como ela está agora." ],
    [ "requestReopen", "Pedir reabertura", "Por que você quer reabrir?", "Enviar o pedido", new ApiError(422, "reopen_window_closed"), "O prazo de 30 dias para pedir a reabertura terminou." ],
    [ "requestReopen", "Pedir reabertura", "Por que você quer reabrir?", "Enviar o pedido", new ApiError(409, "reopen_pending"), "Você já pediu a reabertura desta manifestação." ],
    [ "requestReopen", "Pedir reabertura", "Por que você quer reabrir?", "Enviar o pedido", new ApiError(422, "reopen_already_requested"), "Você já pediu a reabertura desta manifestação." ],
    [ "requestReopen", "Pedir reabertura", "Por que você quer reabrir?", "Enviar o pedido", new ApiError(422, "invalid_transition"), "A manifestação mudou. Veja como ela está agora." ]
  ] as const)("409/422 nas ações: frase própria e releitura (%s, %#)", async (method, open, field, submit, err, text) => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, can_request_reopen: true });
    vi.spyOn(citizenApi, method).mockRejectedValue(err);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, open, field, LONG);
    await user.click(screen.getByRole("button", { name: submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it.each([
    [ new ApiError(409, "already_answered"), "Você já respondeu a pesquisa desta manifestação." ],
    [ new ApiError(422, "satisfaction_window_closed"), "O prazo para responder a pesquisa terminou." ]
  ] as const)("pesquisa recusada pelo estado: frase fora do formulário e releitura (%s)", async (err, text) => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, state: "answered", color: null, can_complement: false, can_answer_satisfaction: true });
    vi.spyOn(citizenApi, "answerSatisfaction").mockRejectedValue(err);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Responder a pesquisa" }));
    await user.click(within(screen.getByRole("group", { name: "Sua demanda foi atendida?" })).getByRole("radio", { name: "Sim" }));
    await user.click(within(screen.getByRole("group", { name: "A resposta foi fácil de entender?" })).getByRole("radio", { name: "Sim" }));
    await user.click(within(screen.getByRole("group", { name: "De 1 a 5, qual sua satisfação com a ouvidoria?" })).getByRole("radio", { name: /^5/ }));
    await user.click(screen.getByRole("button", { name: "Enviar respostas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("group", { name: "Sua demanda foi atendida?" })).toBeNull();
  });

  it("ação com a manifestação sumida (404): a releitura mostra a frase e só Voltar", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValueOnce(DETAIL).mockRejectedValueOnce(new ApiError(404, "not_found"));
    vi.spyOn(citizenApi, "complementManifestation").mockRejectedValue(new ApiError(404, "not_found"));
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", LONG);
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta manifestação não está disponível por aqui.");
    expect(screen.getAllByRole("button").map(b => b.textContent)).toEqual([ "Voltar às manifestações" ]);
  });

  it.each([
    [ "complementManifestation", "Enviar complemento", "Seu complemento", "Enviar o complemento", new ApiError(422, "invalid_request", "body"), "Confira o tamanho do texto." ],
    [ "requestReopen", "Pedir reabertura", "Por que você quer reabrir?", "Enviar o pedido", new ApiError(422, "invalid_request", "reason"), "Escreva o motivo com 10 a 2.000 caracteres." ]
  ] as const)("erro de campo: o formulário fica, com o texto e o erro no campo, sem reler (%s)", async (method, open, field, submit, err, text) => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValue({ ...DETAIL, can_request_reopen: true });
    vi.spyOn(citizenApi, method).mockRejectedValue(err);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, open, field, LONG);
    await user.click(screen.getByRole("button", { name: submit }));
    const box = await screen.findByRole("textbox", { name: field });
    await screen.findByRole("alert");
    expect(box).toHaveAccessibleDescription(new RegExp(text.replace(/\./g, "\\.")));
    expect(box).toHaveValue(LONG);
    expect(box).toHaveFocus();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([
    [ new ApiError(422, "invalid_request", "attachment_ids"), "Um dos anexos não vale mais. Remova e anexe de novo." ],
    [ new ApiError(422, "too_many_attachments"), "No máximo 3 anexos." ],
    [ new ApiError(429, "too_many_requests"), "Muitos envios em pouco tempo. Tente mais tarde." ]
  ] as const)("complemento recusado sem mudar de estado: fica aberto, com o texto (%s)", async (err, text) => {
    const get = vi.spyOn(citizenApi, "manifestation").mockResolvedValue(DETAIL);
    vi.spyOn(citizenApi, "complementManifestation").mockRejectedValue(err);
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={vi.fn()} />);
    await openAndType(user, "Enviar complemento", "Seu complemento", LONG);
    await user.click(screen.getByRole("button", { name: "Enviar o complemento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("textbox", { name: "Seu complemento" })).toHaveValue(LONG);
    expect(screen.getByRole("button", { name: "Enviar o complemento" })).toBeEnabled();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("Voltar às manifestações chama onBack", async () => {
    vi.spyOn(citizenApi, "manifestation").mockResolvedValue(DETAIL);
    const onBack = vi.fn();
    const user = opts();
    render(<ManifestationDetailStep manifestationId="m1" onBack={onBack} />);
    await screen.findByRole("heading", { level: 1, name: "Manifestação 2026-000123" });
    await user.click(screen.getByRole("button", { name: "Voltar às manifestações" }));
    expect(onBack).toHaveBeenCalled();
  });
});
