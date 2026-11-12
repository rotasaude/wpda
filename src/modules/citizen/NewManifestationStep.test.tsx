// Módulo 33 (contrato §3, §14; spec decisões 3, 5, 12; U1, Q46, Q62): nova manifestação identificada ou preservada.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewManifestationStep } from "./NewManifestationStep";
import { citizenApi, ApiError, type Person } from "../../lib/citizenApi";

afterEach(() => { vi.restoreAllMocks(); });

const P1: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null, profile: null };
const P2: Person = { id: "p2", cpf_masked: "***.111.444-**", verification_level: "verified", neighborhood: null, profile: null };
const TEXT = "Esperei quatro horas na recepção e ninguém me chamou.";
const CONFIG = { anonymous_web: true, units: [ { id: "u1", name: "UBS Centro" } ] };
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

  it("dois toques: uma manifestação; recusa do api mantém o texto", async () => {
    const { create } = stub([ P1 ]);
    create.mockRejectedValueOnce(new ApiError(403, "not_own_citizen"));
    const user = userEvent.setup();
    renderStep();
    await fillAndSend(user);
    await send(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha uma das pessoas deste celular.");
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
});
