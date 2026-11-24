// Módulo 33 (contrato §3, §14; spec decisões 3, 5, 12; U1, Q46, Q62): nova manifestação identificada ou preservada.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewManifestationStep } from "./NewManifestationStep";
import { citizenApi, ApiError, type Person } from "../../lib/citizenApi";
import { ZOONOSES_ADDRESS_LABEL, ZOONOSES_NOTICE, ZOONOSES_QUESTION, ombudsmanMessage } from "../../lib/ombudsman";

const pathMessage = (path: string) => ombudsmanMessage(new ApiError(422, "invalid_request", path));

afterEach(() => { vi.restoreAllMocks(); });

const P1: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null, profile: null };
const P2: Person = { id: "p2", cpf_masked: "***.111.444-**", verification_level: "verified", neighborhood: null, profile: null };
const TEXT = "Esperei quatro horas na recepção e ninguém me chamou.";
const CONFIG = { anonymous_web: true, zoonoses: false, units: [ { id: "u1", name: "UBS Centro" } ] };
const CONFIG_ZOO = { ...CONFIG, zoonoses: true };
const ADDRESS = "Rua das Flores, 120, fundos";
const PRESERVED = /não escreva no texto seu nome, CPF, telefone ou endereço/;
const FROZEN = /Depois de enviado, este texto não pode ser alterado/;

type User = ReturnType<typeof userEvent.setup>;

function stub(people: Person[], config: typeof CONFIG = CONFIG) {
  const peopleSpy = vi.spyOn(citizenApi, "people").mockResolvedValue({ people });
  const configSpy = vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(config);
  const create = vi.spyOn(citizenApi, "createManifestation").mockResolvedValue({ id: "m9", protocol: "2026-000124", due_on: "2026-12-12" });
  return { create, peopleSpy, configSpy };
}
const next = (user: User) => user.click(screen.getByRole("button", { name: "Continuar" }));
const send = (user: User) => user.click(screen.getByRole("button", { name: "Enviar manifestação" }));
const textbox = () => screen.getByRole("textbox", { name: "Conte o que aconteceu" });

async function fillAndSend(user: User, kind = "Reclamação", mode = "Identificada", text = TEXT) {
  await user.click(await screen.findByRole("radio", { name: new RegExp(`^${kind}`) }));
  await next(user);
  await user.click(await screen.findByRole("radio", { name: new RegExp(`^${mode}`) }));
  await next(user);
  await user.click(await screen.findByRole("textbox", { name: "Conte o que aconteceu" }));
  await user.paste(text);
}

const kindRadio = (user: User, kind: string) => screen.findByRole("radio", { name: new RegExp(`^${kind}`) }).then(r => user.click(r));
const addressBox = () => screen.getByRole("textbox", { name: ZOONOSES_ADDRESS_LABEL });

// Na tela da pergunta: responde, continua e, com Sim, escolhe o subtipo pelo rótulo exato e continua.
async function answerAnimal(user: User, answer: "Sim" | "Não", subtype?: string) {
  await user.click(await screen.findByRole("radio", { name: answer }));
  await next(user);
  if (subtype) {
    await user.click(await screen.findByRole("radio", { name: subtype }));
    await next(user);
  }
}

async function pickMode(user: User, mode = "Identificada") {
  await user.click(await screen.findByRole("radio", { name: new RegExp(`^${mode}`) }));
  await next(user);
}

async function identify(user: User, cpf: string, name: string) {
  const cpfBox = await screen.findByRole("textbox", { name: "CPF" });
  await user.clear(cpfBox);
  await user.type(cpfBox, cpf);
  const nameBox = screen.getByRole("textbox", { name: "Seu nome" });
  await user.clear(nameBox);
  if (name) await user.type(nameBox, name);
  await next(user);
}

const renderStep = (props: Partial<Parameters<typeof NewManifestationStep>[0]> = {}) =>
  render(<NewManifestationStep onBack={vi.fn()} onDone={vi.fn()} {...props} />);

describe("NewManifestationStep", () => {
  it("uma pessoa (Q62): vai direto ao tipo; manda o corpo exato e mostra o protocolo", async () => {
    const { create } = stub([ P1 ]);
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderStep({ onDone });
    expect(await screen.findByRole("heading", { level: 1, name: "Que tipo de manifestação?" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /CPF/ })).toBeNull();
    await fillAndSend(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u1");
    await send(user);
    expect(create).toHaveBeenCalledWith({
      who: { citizenId: "p1" }, kind: "complaint", mode: "identified", body: TEXT, healthUnitId: "u1", attachmentIds: []
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Manifestação registrada" })).toBeInTheDocument();
    expect(screen.getByText("Protocolo 2026-000124")).toBeInTheDocument();
    expect(screen.getByText("Resposta prevista até 12/12/2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver minha manifestação" }));
    expect(onDone).toHaveBeenCalledWith("m9");
  });

  it("duas pessoas (Q62): a escolha é obrigatória e vai o citizen_id escolhido; nunca 'Outra pessoa'", async () => {
    const { create } = stub([ P1, P2 ]);
    const user = userEvent.setup();
    renderStep();
    expect(await screen.findByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByText(/Outra pessoa/)).toBeNull();
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a pessoa.");
    await user.click(screen.getByRole("radio", { name: /\*\*\*\.111\.444-\*\*/ }));
    await next(user);
    await fillAndSend(user, "Sugestão");
    await send(user);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ who: { citizenId: "p2" }, kind: "suggestion" }));
  });

  it("nenhuma pessoa (U1, Q62): pede CPF e nome e manda { cpf, fullName } só com dígitos e nome aparado", async () => {
    const { create } = stub([]);
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderStep({ onBack });
    expect(await screen.findByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText(/termo/i)).toBeNull();
    await identify(user, "11111111111", "Maria da Silva");
    expect(screen.getByRole("textbox", { name: "CPF" })).toHaveAccessibleDescription(/CPF inválido. Confira os números./);
    expect(screen.getByRole("textbox", { name: "CPF" })).toHaveFocus();
    await identify(user, "52998224725", "");
    expect(screen.getByRole("textbox", { name: "Seu nome" })).toHaveAccessibleDescription(/Escreva seu nome./);
    expect(screen.getByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "CPF" })).toHaveValue("529.982.247-25");
    await identify(user, "52998224725", "  Maria da Silva  ");
    expect(await screen.findByRole("heading", { level: 1, name: "Que tipo de manifestação?" })).toBeInTheDocument();
    await fillAndSend(user, "Denúncia", "Com identidade preservada");
    await send(user);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      who: { cpf: "52998224725", fullName: "Maria da Silva" }, kind: "report", mode: "preserved", body: TEXT,
      healthUnitId: null, attachmentIds: []
    });
  });

  it("modos: dica de não escrever dados pessoais na preservada, aviso do texto congelado na identificada", async () => {
    stub([ P1 ]);
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user, "Denúncia", "Com identidade preservada");
    expect(textbox()).toHaveAccessibleDescription(PRESERVED);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("radio", { name: /^Identificada/ }));
    await next(user);
    expect(textbox()).toHaveAccessibleDescription(FROZEN);
    expect(textbox()).toHaveValue(TEXT);
  });

  it("cada tipo e modo traz a explicação", async () => {
    stub([ P1 ]);
    const user = userEvent.setup();
    renderStep();
    expect(await screen.findByRole("radio", { name: "Reclamação — Algo deu errado no atendimento." })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Elogio/ }));
    await next(user);
    expect(screen.getByRole("radio", { name: /^Com identidade preservada — Só o ouvidor pode ver quem você é/ })).toBeInTheDocument();
  });

  it("Continuar sem escolha: erro no grupo; Voltar não apaga o que foi preenchido; Voltar do primeiro sai", async () => {
    stub([ P1 ]);
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderStep({ onBack });
    await screen.findByRole("heading", { level: 1, name: "Que tipo de manifestação?" });
    await next(user);
    expect(screen.getByRole("group", { name: "Tipo de manifestação" })).toHaveAccessibleDescription("Escolha o tipo.");
    await user.click(screen.getByRole("radio", { name: /^Elogio/ }));
    await next(user);
    await next(user);
    expect(screen.getByRole("group", { name: "Forma de identificação" })).toHaveAccessibleDescription("Escolha como se identificar.");
    await user.click(screen.getByRole("radio", { name: /^Identificada/ }));
    await next(user);
    await user.click(textbox());
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: /^Identificada/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("radio", { name: /^Elogio/ })).toBeChecked();
    await next(user);
    await next(user);
    expect(textbox()).toHaveValue(TEXT);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("texto curto: erro no campo, com foco, sem POST; vai o texto aparado (carry)", async () => {
    const { create } = stub([ P1 ]);
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user, "Reclamação", "Identificada", "Curto demais");
    await send(user);
    expect(create).not.toHaveBeenCalled();
    expect(textbox()).toHaveAccessibleDescription(/Escreva pelo menos 20 caracteres./);
    expect(textbox()).toHaveFocus();
    await user.clear(textbox());
    await user.paste(`   ${TEXT}  \n`);
    await send(user);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ body: TEXT, healthUnitId: null }));
  });

  it("denúncia com o anônimo ligado: oferece o caminho anônimo", async () => {
    stub([ P1 ]);
    const onAnonymous = vi.fn();
    const user = userEvent.setup();
    renderStep({ onAnonymous });
    await user.click(await screen.findByRole("radio", { name: /^Reclamação/ }));
    expect(screen.queryByRole("button", { name: /denúncia anônima/ })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /^Denúncia/ }));
    await user.click(screen.getByRole("button", { name: "Prefere não se identificar? Faça uma denúncia anônima" }));
    expect(onAnonymous).toHaveBeenCalled();
  });

  it("anônimo desligado no public_config, ou sem onAnonymous: sem o caminho anônimo", async () => {
    stub([ P1 ], { ...CONFIG, anonymous_web: false });
    const user = userEvent.setup();
    const { unmount } = renderStep({ onAnonymous: vi.fn() });
    await user.click(await screen.findByRole("radio", { name: /^Denúncia/ }));
    expect(screen.queryByRole("button", { name: /denúncia anônima/ })).toBeNull();
    unmount();
    vi.restoreAllMocks();
    stub([ P1 ]);
    renderStep();
    await user.click(await screen.findByRole("radio", { name: /^Denúncia/ }));
    expect(screen.queryByRole("button", { name: /denúncia anônima/ })).toBeNull();
  });

  it("public_config recusado: sem unidade, manda sem unidade", async () => {
    stub([ P1 ]);
    vi.mocked(citizenApi.ombudsmanPublicConfig).mockRejectedValue(new ApiError(403, "feature_disabled"));
    const create = vi.mocked(citizenApi.createManifestation);
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    expect(screen.queryByRole("combobox")).toBeNull();
    await send(user);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ healthUnitId: null }));
  });

  it("people falhou: frase e Voltar", async () => {
    stub([ P1 ]);
    vi.mocked(citizenApi.people).mockRejectedValue(new TypeError("fetch"));
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderStep({ onBack });
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão. Verifique a internet e tente de novo.");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  // Uma pessoa só (Q62): não há o que escolher, então a frase é a genérica, não "Escolha uma das pessoas".
  it("dois toques: uma manifestação; recusa do api mantém o texto", async () => {
    const { create } = stub([ P1 ]);
    create.mockRejectedValueOnce(new ApiError(403, "not_own_citizen"));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado. Tente de novo.");
    expect(screen.queryByText("Escolha uma das pessoas deste celular.")).toBeNull();
    expect(screen.getByRole("textbox")).toHaveValue(TEXT);
    await user.dblClick(screen.getByRole("button", { name: "Enviar manifestação" }));
    await screen.findByRole("heading", { level: 1, name: "Manifestação registrada" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each([
    [ "403 not_own_citizen", new ApiError(403, "not_own_citizen") ],
    [ "422 path citizen_id", new ApiError(422, "invalid_request", "citizen_id") ]
  ])("duas pessoas, %s: relê as pessoas e volta à escolha, sem apagar o texto", async (_n, error) => {
    const { create, peopleSpy } = stub([ P1, P2 ]);
    create.mockRejectedValueOnce(error);
    const user = userEvent.setup();
    renderStep();
    await user.click(await screen.findByRole("radio", { name: /\*\*\*\.982\.247-\*\*/ }));
    await next(user);
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(peopleSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("group")).toHaveAccessibleDescription("Escolha uma das pessoas deste celular.");
    expect(screen.getByRole("radio", { name: /\*\*\*\.982\.247-\*\*/ })).not.toBeChecked();
    await user.click(screen.getByRole("radio", { name: /\*\*\*\.111\.444-\*\*/ }));
    await next(user);
    await next(user);
    await next(user);
    expect(textbox()).toHaveValue(TEXT);
    await send(user);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ who: { citizenId: "p2" } }));
  });

  it.each([
    [ "invalid_cpf", new ApiError(422, "invalid_cpf", "cpf"), "CPF", "CPF inválido. Confira os números." ],
    [ "path cpf", new ApiError(422, "invalid_request", "cpf"), "CPF", "CPF inválido. Confira os números." ],
    [ "path full_name", new ApiError(422, "invalid_request", "full_name"), "Seu nome", "Escreva seu nome, com 2 a 120 caracteres." ]
  ])("sem pessoa, %s: volta à identificação com o erro no campo", async (_n, error, label, message) => {
    const { create } = stub([]);
    create.mockRejectedValueOnce(error);
    const user = userEvent.setup();
    renderStep();
    await identify(user, "52998224725", "Maria da Silva");
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: label })).toHaveAccessibleDescription(new RegExp(message.replace(/\./g, "\\.")));
    expect(screen.getByRole("textbox", { name: "Seu nome" })).toHaveValue("Maria da Silva");
    await next(user);
    await next(user);
    await next(user);
    expect(textbox()).toHaveValue(TEXT);
  });

  it("sem pessoa, too_many_people: frase na identificação", async () => {
    const { create } = stub([]);
    create.mockRejectedValueOnce(new ApiError(422, "too_many_people"));
    const user = userEvent.setup();
    renderStep();
    await identify(user, "52998224725", "Maria da Silva");
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Quem está fazendo a manifestação?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Este celular já tem 10 pessoas cadastradas.");
  });

  it("422 path health_unit_id: relê as unidades, volta a nenhuma e mostra a frase na unidade", async () => {
    const { create, configSpy } = stub([ P1 ]);
    create.mockRejectedValueOnce(new ApiError(422, "invalid_request", "health_unit_id"));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u1");
    await send(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Essa unidade não está mais na lista. Escolha de novo.");
    expect(configSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" })).toHaveValue("");
    expect(textbox()).toHaveValue(TEXT);
  });

  it("422 path body: erro no campo, com foco", async () => {
    const { create } = stub([ P1 ]);
    create.mockRejectedValueOnce(new ApiError(422, "invalid_request", "body"));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await send(user);
    await screen.findByRole("alert");
    expect(textbox()).toHaveAccessibleDescription(/Confira o tamanho do texto./);
    expect(textbox()).toHaveFocus();
    expect(textbox()).toHaveValue(TEXT);
  });

  it("anexo subindo: Enviar fica desligado com o motivo e não manda sem ele; depois manda com o id", async () => {
    const { create } = stub([ P1 ]);
    let resolve!: (v: { id: string }) => void;
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await user.upload(screen.getByLabelText("Anexar arquivo (opcional)"), new File([ "%PDF-1" ], "laudo.pdf", { type: "application/pdf" }));
    await screen.findByText("Aguarde o anexo terminar de subir.");
    expect(screen.getByRole("button", { name: "Enviar manifestação" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar manifestação" })).toHaveAccessibleDescription("Aguarde o anexo terminar de subir.");
    await send(user);
    expect(create).not.toHaveBeenCalled();
    await act(async () => { resolve({ id: "a1" }); });
    expect(await screen.findByText("Anexo 1")).toBeInTheDocument();
    expect(screen.queryByText("Aguarde o anexo terminar de subir.")).toBeNull();
    await send(user);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ attachmentIds: [ "a1" ], body: TEXT }));
  });

  it("Voltar no meio do upload: outro anexo só sobe depois do primeiro, e Enviar não liga antes da hora", async () => {
    const { create } = stub([ P1 ]);
    let first!: (v: { id: string }) => void;
    let second!: (v: { id: string }) => void;
    const upload = vi.spyOn(citizenApi, "uploadOmbudsmanAttachment")
      .mockReturnValueOnce(new Promise((r) => { first = r; }))
      .mockReturnValueOnce(new Promise((r) => { second = r; }));
    const file = () => new File([ "%PDF-1" ], "laudo.pdf", { type: "application/pdf" });
    const picker = () => screen.getByLabelText("Anexar arquivo (opcional)");
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await user.upload(picker(), file());
    await screen.findByText("Aguarde o anexo terminar de subir.");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await next(user);
    expect(picker()).toBeDisabled();
    await user.upload(picker(), file());
    expect(upload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviar manifestação" })).toBeDisabled();
    await act(async () => { first({ id: "a1" }); });
    expect(picker()).toBeEnabled();
    await user.upload(picker(), file());
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Enviar manifestação" })).toBeDisabled();
    await act(async () => { second({ id: "a2" }); });
    await send(user);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ attachmentIds: [ "a2" ] }));
  });

  it("resposta do POST depois de sair da tela é ignorada: nada relê nem desenha", async () => {
    const { create, peopleSpy, configSpy } = stub([ P1 ]);
    let resolve!: (v: { id: string; protocol: string; due_on: string | null }) => void;
    let reject!: (e: unknown) => void;
    create.mockReturnValueOnce(new Promise((r) => { resolve = r; }))
      .mockImplementation(() => new Promise((_r, j) => { reject = j; }));
    const user = userEvent.setup();

    let view = renderStep();
    await fillAndSend(user);
    await send(user);
    view.unmount();
    await act(async () => { resolve({ id: "m9", protocol: "2026-000124", due_on: "2026-12-12" }); });
    expect(screen.queryByText(/Protocolo/)).toBeNull();

    for (const err of [ new ApiError(403, "not_own_citizen"), new ApiError(422, "invalid_request", "health_unit_id") ]) {
      view = renderStep();
      await fillAndSend(user);
      await send(user);
      const [ people, config ] = [ peopleSpy.mock.calls.length, configSpy.mock.calls.length ];
      view.unmount();
      await act(async () => { reject(err); });
      expect(peopleSpy).toHaveBeenCalledTimes(people);
      expect(configSpy).toHaveBeenCalledTimes(config);
    }
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("enquanto o POST corre, Voltar fica desligado", async () => {
    const { create } = stub([ P1 ]);
    let resolve!: (v: { id: string; protocol: string; due_on: string | null }) => void;
    create.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderStep({ onBack });
    await fillAndSend(user);
    await send(user);
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("textbox", { name: "Conte o que aconteceu" })).toBeInTheDocument();
    await act(async () => { resolve({ id: "m9", protocol: "2026-000124", due_on: "2026-12-12" }); });
    expect(await screen.findByRole("heading", { level: 1, name: "Manifestação registrada" })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("enquanto o POST corre, o texto fica só para leitura e a unidade desligada; depois de uma recusa voltam", async () => {
    const { create } = stub([ P1 ]);
    let reject!: (e: unknown) => void;
    create.mockReturnValueOnce(new Promise((_r, j) => { reject = j; }));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    const unit = screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" });
    expect(textbox()).not.toHaveAttribute("readonly");
    expect(unit).toBeEnabled();
    await send(user);
    expect(textbox()).toHaveAttribute("readonly");
    expect(unit).toBeDisabled();
    await user.type(textbox(), " mais");
    expect(textbox()).toHaveValue(TEXT);
    await act(async () => { reject(new ApiError(429, "too_many_requests")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitos envios em pouco tempo. Tente mais tarde.");
    expect(textbox()).not.toHaveAttribute("readonly");
    expect(unit).toBeEnabled();
  });

  it.each([
    [ "path attachment_ids", new ApiError(422, "invalid_request", "attachment_ids"), "Um dos anexos não vale mais. Remova e anexe de novo." ],
    [ "too_many_attachments", new ApiError(422, "too_many_attachments"), "No máximo 3 anexos." ],
    [ "429 too_many_requests", new ApiError(429, "too_many_requests"), "Muitos envios em pouco tempo. Tente mais tarde." ],
    [ "403 feature_disabled", new ApiError(403, "feature_disabled"), "A Ouvidoria não está disponível agora nesta cidade." ]
  ])("%s: frase na tela do texto, sem apagar nada", async (_n, error, message) => {
    const { create } = stub([ P1 ]);
    create.mockRejectedValueOnce(error);
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(textbox()).toHaveValue(TEXT);
    expect(screen.getByRole("button", { name: "Enviar manifestação" })).toBeEnabled();
  });
  describe("módulo 35b: zoonoses", () => {
    it("zoonoses ligado, Solicitação: pergunta, subtipo, aviso e endereço vão no corpo", async () => {
      const { create } = stub([ P1 ], CONFIG_ZOO);
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      expect(await screen.findByRole("heading", { level: 1, name: ZOONOSES_QUESTION })).toBeInTheDocument();
      await answerAnimal(user, "Sim", "Escorpião");
      await pickMode(user);
      const notice = screen.getByText(ZOONOSES_NOTICE);
      const button = screen.getByRole("button", { name: "Enviar manifestação" });
      expect(notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice.compareDocumentPosition(addressBox()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await user.type(addressBox(), `  ${ADDRESS}  `);
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        kind: "request", zoonoses: { subtype: "scorpion", placeAddress: ADDRESS }
      }));
      expect(await screen.findByRole("heading", { level: 1, name: "Manifestação registrada" })).toBeInTheDocument();
    });

    it("Denúncia também pergunta; Reclamação, Elogio e Sugestão não", async () => {
      stub([ P1 ], CONFIG_ZOO);
      for (const [ kind, asks ] of [ [ "Denúncia", true ], [ "Reclamação", false ], [ "Elogio", false ], [ "Sugestão", false ] ] as const) {
        const user = userEvent.setup();
        const view = renderStep();
        await kindRadio(user, kind);
        await next(user);
        const title = asks ? ZOONOSES_QUESTION : "Como você quer se identificar?";
        expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
        view.unmount();
      }
    });

    it("zoonoses desligado: a tela e o corpo do 33", async () => {
      const { create } = stub([ P1 ], CONFIG);
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      expect(await screen.findByRole("heading", { level: 1, name: "Como você quer se identificar?" })).toBeInTheDocument();
      expect(screen.queryByText(ZOONOSES_QUESTION)).toBeNull();
      await pickMode(user);
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(create.mock.calls[0][0].zoonoses ?? null).toBeNull();
    });

    it("Não: segue sem subtipo e sem endereço", async () => {
      const { create } = stub([ P1 ], CONFIG_ZOO);
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      await answerAnimal(user, "Não");
      expect(screen.queryByRole("radio", { name: "Escorpião" })).toBeNull();
      await pickMode(user);
      expect(screen.queryByRole("textbox", { name: ZOONOSES_ADDRESS_LABEL })).toBeNull();
      expect(screen.queryByText(ZOONOSES_NOTICE)).toBeNull();
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(create.mock.calls[0][0].zoonoses ?? null).toBeNull();
    });

    it("trocar o tipo ou responder Não apaga o subtipo e o endereço", async () => {
      const { create } = stub([ P1 ], CONFIG_ZOO);
      const user = userEvent.setup();
      const view = renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      await answerAnimal(user, "Sim", "Morcego");
      await pickMode(user);
      await user.type(addressBox(), ADDRESS);
      const back = () => user.click(screen.getByRole("button", { name: "Voltar" }));
      await back(); await back(); await back(); await back(); // mode → subtype → animal → kind
      expect(await screen.findByRole("heading", { level: 1, name: "Que tipo de manifestação?" })).toBeInTheDocument();
      await kindRadio(user, "Reclamação");
      await next(user);
      await next(user); // a forma de identificação continua escolhida
      expect(screen.queryByRole("textbox", { name: ZOONOSES_ADDRESS_LABEL })).toBeNull();
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(create.mock.calls[0][0].zoonoses ?? null).toBeNull();
      view.unmount();

      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      await answerAnimal(user, "Sim", "Morcego");
      await back(); await back(); // mode → subtype → animal
      await answerAnimal(user, "Não");
      await pickMode(user);
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(create.mock.calls[1][0].zoonoses ?? null).toBeNull();
    });

    it("endereço obrigatório: curto ou vazio, erro no campo com foco e nada enviado", async () => {
      const { create } = stub([ P1 ], CONFIG_ZOO);
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      await answerAnimal(user, "Sim", "Rato ou outro roedor");
      await pickMode(user);
      await user.type(addressBox(), "Rua A");
      await user.click(textbox());
      await user.paste(TEXT);
      await send(user);
      expect(addressBox()).toHaveAttribute("aria-invalid", "true");
      expect(addressBox()).toHaveFocus();
      expect(addressBox()).toHaveAccessibleDescription(/Escreva pelo menos 10 caracteres\./);
      expect(create).not.toHaveBeenCalled();
      await user.clear(addressBox());
      await send(user);
      expect(addressBox()).toHaveFocus();
      expect(create).not.toHaveBeenCalled();
    });

    it("sem escolha na pergunta e no subtipo: erro no grupo", async () => {
      stub([ P1 ], CONFIG_ZOO);
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      await next(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("Escolha uma opção.");
      await user.click(screen.getByRole("radio", { name: "Sim" }));
      await next(user);
      await next(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("Escolha o assunto.");
    });

    it("public_config lento: a pergunta não é pulada", async () => {
      const { configSpy } = stub([ P1 ], CONFIG_ZOO);
      let resolve!: (c: typeof CONFIG_ZOO) => void;
      configSpy.mockReturnValueOnce(new Promise(r => { resolve = r; }));
      const user = userEvent.setup();
      renderStep();
      expect(await screen.findByRole("status")).toHaveTextContent("Carregando…");
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
      expect(screen.queryByRole("radio")).toBeNull();
      await act(async () => { resolve(CONFIG_ZOO); });
      await kindRadio(user, "Solicitação");
      await next(user);
      expect(await screen.findByRole("heading", { level: 1, name: ZOONOSES_QUESTION })).toBeInTheDocument();
    });

    it("public_config recusado: sem a pergunta", async () => {
      const { configSpy } = stub([ P1 ], CONFIG_ZOO);
      configSpy.mockRejectedValue(new ApiError(403, "feature_disabled"));
      const user = userEvent.setup();
      renderStep();
      await kindRadio(user, "Solicitação");
      await next(user);
      expect(await screen.findByRole("heading", { level: 1, name: "Como você quer se identificar?" })).toBeInTheDocument();
      expect(screen.queryByText(ZOONOSES_QUESTION)).toBeNull();
    });

    async function toText(user: User) {
      await kindRadio(user, "Solicitação");
      await next(user);
      await answerAnimal(user, "Sim", "Carrapato");
      await pickMode(user);
      await user.type(addressBox(), ADDRESS);
      await user.click(textbox());
      await user.paste(TEXT);
    }

    it("422 place_address: erro no campo do endereço, com foco", async () => {
      const { create } = stub([ P1 ], CONFIG_ZOO);
      create.mockRejectedValueOnce(new ApiError(422, "invalid_request", "place_address"));
      const user = userEvent.setup();
      renderStep();
      await toText(user);
      await send(user);
      await screen.findByText(pathMessage("place_address"));
      expect(addressBox()).toHaveAccessibleDescription(pathMessage("place_address"));
      expect(addressBox()).toHaveFocus();
      expect(addressBox()).toHaveValue(ADDRESS);
      expect(textbox()).toHaveValue(TEXT);
    });

    it("422 zoonoses_subtype: relê, tira a escolha e mantém o texto", async () => {
      const { create, configSpy } = stub([ P1 ], CONFIG_ZOO);
      configSpy.mockResolvedValueOnce(CONFIG_ZOO).mockResolvedValueOnce(CONFIG);
      create.mockRejectedValueOnce(new ApiError(422, "invalid_request", "zoonoses_subtype"));
      const user = userEvent.setup();
      renderStep();
      await toText(user);
      await send(user);
      expect(await screen.findByRole("alert")).toHaveTextContent(pathMessage("zoonoses_subtype"));
      expect(configSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("textbox", { name: ZOONOSES_ADDRESS_LABEL })).toBeNull();
      expect(screen.queryByText(ZOONOSES_NOTICE)).toBeNull();
      expect(textbox()).toHaveValue(TEXT);
      await send(user);
      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[1][0].zoonoses ?? null).toBeNull();
    });
  });
});
