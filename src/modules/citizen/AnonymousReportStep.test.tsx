// Módulo 33 (contrato §4, §14; spec decisão 6): entrada da Ouvidoria e denúncia anônima sem login.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnonymousReportStep } from "./AnonymousReportStep";
import { OmbudsmanEntry } from "./OmbudsmanEntry";
import { citizenApi, ApiError } from "../../lib/citizenApi";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const CONFIG = { anonymous_web: true, units: [ { id: "u1", name: "UBS Centro" } ] };
const TEXT = "Na UBS Centro cobraram consulta, o que é proibido no SUS.";
const WARNING = "Sem identificação, você não recebe protocolo nem acompanha a resposta.";
const PHONE_LINE = "Reclamações, denúncias, elogios, sugestões e pedidos à Secretaria de Saúde.";
const DESKTOP_LINE = "Denúncias à Secretaria de Saúde, sem se identificar. Reclamações, elogios, sugestões e pedidos são feitos pelo celular.";
const PHONE_ONLY_REPORTS = "Use este caminho só para denúncias. Para reclamar, elogiar, sugerir ou pedir, faça uma manifestação.";
const DESKTOP_ONLY_REPORTS = "Use este caminho só para denúncias. Para reclamar, elogiar, sugerir ou pedir, faça uma manifestação na tela inicial do celular.";

// Espera a leitura do public_config terminar e o React desenhar o resultado, antes de afirmar ausência.
async function settled(spy: { mock: { results: { value: unknown }[] } }) {
  await act(async () => { await Promise.allSettled(spy.mock.results.map(r => r.value)); });
}

describe("OmbudsmanEntry", () => {
  it("com anonymous_web: os dois caminhos", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    const onManifest = vi.fn(); const onAnonymous = vi.fn();
    const user = userEvent.setup();
    render(<OmbudsmanEntry onManifest={onManifest} onAnonymous={onAnonymous} />);
    expect(await screen.findByRole("heading", { level: 2, name: "Ouvidoria" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ouvidoria" }))
      .toHaveTextContent(PHONE_LINE);
    expect(screen.queryByText(DESKTOP_LINE)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Fazer uma manifestação" }));
    await user.click(screen.getByRole("button", { name: "Denúncia anônima" }));
    expect(onManifest).toHaveBeenCalledOnce(); expect(onAnonymous).toHaveBeenCalledOnce();
  });

  it("sem anonymous_web: só a manifestação", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue({ ...CONFIG, anonymous_web: false });
    render(<OmbudsmanEntry onManifest={vi.fn()} onAnonymous={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Fazer uma manifestação" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
  });

  it("public_config 403: nada", async () => {
    const spy = vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockRejectedValue(new ApiError(403, "feature_disabled"));
    const { container } = render(<OmbudsmanEntry onManifest={vi.fn()} onAnonymous={vi.fn()} />);
    await settled(spy);
    expect(container).toBeEmptyDOMElement();
  });

  // U2: no desktop de produção não há sessão, então não há "Fazer uma manifestação".
  it("sem onManifest: só a denúncia anônima", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    render(<OmbudsmanEntry onAnonymous={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Denúncia anônima" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fazer uma manifestação" })).toBeNull();
    expect(screen.getByText(DESKTOP_LINE)).toBeInTheDocument();
    expect(screen.queryByText(PHONE_LINE)).toBeNull();
  });

  it("sem onManifest e sem anonymous_web: nada", async () => {
    const spy = vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue({ ...CONFIG, anonymous_web: false });
    const { container } = render(<OmbudsmanEntry onAnonymous={vi.fn()} />);
    await settled(spy);
    expect(container).toBeEmptyDOMElement();
  });

  it("lê public_config uma vez", async () => {
    const spy = vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    const { rerender } = render(<OmbudsmanEntry onManifest={vi.fn()} onAnonymous={vi.fn()} />);
    await screen.findByRole("button", { name: "Denúncia anônima" });
    rerender(<OmbudsmanEntry onManifest={vi.fn()} onAnonymous={vi.fn()} />);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("AnonymousReportStep", () => {
  it("denúncia anônima: aviso antes do envio; enviada sem protocolo", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    const send = vi.spyOn(citizenApi, "sendAnonymousReport")
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeInTheDocument();
    const button = await screen.findByRole("button", { name: "Enviar denúncia" });
    const warnings = screen.getAllByText(WARNING);
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) expect(w.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(PHONE_ONLY_REPORTS)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "O que você quer denunciar?" }))
      .toHaveAccessibleDescription(/Conte o que aconteceu, onde e quando\. Não escreva seu nome, CPF ou telefone\./);
    await user.selectOptions(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u1");
    await user.click(screen.getByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(`  ${TEXT}  `);
    await user.click(button);
    expect(send).toHaveBeenCalledWith({ body: TEXT, healthUnitId: "u1" });
    expect(await screen.findByRole("heading", { level: 1, name: "Denúncia enviada" })).toBeInTheDocument();
    expect(screen.getByText("Recebemos a sua denúncia. Ela será analisada pela Ouvidoria da Saúde.")).toBeInTheDocument();
    expect(screen.getByText("Como você não se identificou, não há protocolo nem acompanhamento por aqui.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[Pp]rotocolo \d|2026-\d{6}/);
    expect(screen.queryByRole("button", { name: /anexo/i })).toBeNull();
  });

  it("sem anexo e sem campo de contato", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await screen.findByRole("button", { name: "Enviar denúncia" });
    expect(document.querySelector("input[type=file]")).toBeNull();
    expect(screen.queryByLabelText(/anexo|arquivo/i)).toBeNull();
    expect(screen.queryByLabelText(/telefone|celular|e-mail|nome|cpf/i)).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("no fio: corpo exato, sem cookie, sem sufixo; o protocolo devolvido não aparece", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/citizen/ombudsman/public_config") return new Response(JSON.stringify(CONFIG), { status: 200 });
      if (url === "/citizen/ombudsman/anonymous_reports" && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, protocol: "2026-000999", id: "x" }), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchFn);
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(`\n${TEXT}\n`);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await screen.findByRole("heading", { level: 1, name: "Denúncia enviada" });
    const posts = fetchFn.mock.calls.filter(([ , init ]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    const [ url, init ] = posts[0] as [string, RequestInit];
    expect(url).toBe("/citizen/ombudsman/anonymous_reports");
    expect(init.credentials).toBe("omit");
    expect(Object.keys(init.headers as Record<string, string>).map(k => k.toLowerCase())).not.toContain("cookie");
    expect(init.body).toBe(JSON.stringify({ body: TEXT }));
    expect(document.body.textContent).not.toMatch(/2026-000999|[Pp]rotocolo \d/);
  });

  it("texto curto: erro no campo e nada enviado", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    const send = vi.spyOn(citizenApi, "sendAnonymousReport");
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste("curto");
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(/Escreva pelo menos 20 caracteres\./);
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(send).not.toHaveBeenCalled();
  });

  it("dois toques: um POST", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    let resolve!: () => void;
    const send = vi.spyOn(citizenApi, "sendAnonymousReport").mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.dblClick(screen.getByRole("button", { name: "Enviar denúncia" }));
    resolve();
    await screen.findByRole("heading", { level: 1, name: "Denúncia enviada" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("enquanto envia, o texto fica só para leitura e a unidade desligada; depois de uma recusa voltam", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    let reject!: (e: unknown) => void;
    vi.spyOn(citizenApi, "sendAnonymousReport").mockReturnValue(new Promise<void>((_r, j) => { reject = j; }));
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    const box = await screen.findByRole("textbox", { name: "O que você quer denunciar?" });
    const unit = screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" });
    await user.click(box);
    await user.paste(TEXT);
    expect(box).not.toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(box).toHaveAttribute("readonly");
    expect(unit).toBeDisabled();
    await user.type(box, " mais");
    expect(box).toHaveValue(TEXT);
    await act(async () => { reject(new ApiError(429, "too_many_requests")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitos envios em pouco tempo. Tente mais tarde.");
    expect(box).not.toHaveAttribute("readonly");
    expect(unit).toBeEnabled();
  });

  it.each([
    [ new ApiError(429, "too_many_requests"), "Muitos envios em pouco tempo. Tente mais tarde." ],
    [ new ApiError(429, "daily_cap_reached"), "O canal de denúncias recebeu muitas mensagens hoje. Tente mais tarde." ],
    [ new ApiError(413, "payload_too_large"), "O texto ficou grande demais. Encurte e tente de novo." ]
  ])("recusa %o: frase própria e o texto continua", async (err, text) => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    vi.spyOn(citizenApi, "sendAnonymousReport").mockRejectedValue(err);
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("textbox")).toHaveValue(TEXT);
  });

  it.each([
    [ "ombudsman_anonymous_web", "A denúncia anônima não está disponível agora nesta cidade." ],
    [ "ombudsman", "A Ouvidoria não está disponível agora nesta cidade." ]
  ])("403 feature_disabled no envio (feature %s): a frase diz o que foi desligado, e o texto continua", async (feature, message) => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    vi.spyOn(citizenApi, "sendAnonymousReport").mockRejectedValue(new ApiError(403, "feature_disabled", undefined, feature));
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("textbox")).toHaveValue(TEXT);
  });

  it("422 health_unit_id: erro na unidade, relê a lista e volta a 'Nenhuma unidade específica'", async () => {
    const config = vi.spyOn(citizenApi, "ombudsmanPublicConfig")
      .mockResolvedValueOnce(CONFIG)
      .mockResolvedValueOnce({ anonymous_web: true, units: [ { id: "u2", name: "UBS Norte" } ] });
    vi.spyOn(citizenApi, "sendAnonymousReport").mockRejectedValue(new ApiError(422, "invalid_request", "health_unit_id"));
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u1");
    await user.click(screen.getByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Essa unidade não está mais na lista. Escolha de novo.");
    expect(await screen.findByRole("option", { name: "UBS Norte" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "UBS Centro" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Nenhuma unidade específica" })).toHaveProperty("selected", true);
    expect(config).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("textbox")).toHaveValue(TEXT);
    await user.selectOptions(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("422 body: erro no campo, com foco, e o texto continua", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    vi.spyOn(citizenApi, "sendAnonymousReport").mockRejectedValue(new ApiError(422, "invalid_request", "body"));
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await vi.waitFor(() => expect(screen.getByRole("textbox")).toHaveAccessibleDescription(/Confira o tamanho do texto\./));
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue(TEXT);
  });

  it.each([
    [ "anonymous_web desligado", () => vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue({ ...CONFIG, anonymous_web: false }) ],
    [ "public_config 403", () => vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockRejectedValue(new ApiError(403, "feature_disabled")) ]
  ])("%s: explica e só volta", async (_name, arrange) => {
    arrange();
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={onBack} />);
    expect(await screen.findByText("A denúncia anônima não está disponível agora nesta cidade.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar denúncia" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("confirmação: 'Voltar ao início' chama onBack", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    vi.spyOn(citizenApi, "sendAnonymousReport").mockResolvedValue(undefined);
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={onBack} />);
    await user.click(await screen.findByRole("textbox", { name: "O que você quer denunciar?" }));
    await user.paste(TEXT);
    await user.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await user.click(await screen.findByRole("button", { name: "Voltar ao início" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("fora do celular (U2): a manifestação fica na tela inicial do celular", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue(CONFIG);
    render(<AnonymousReportStep offPhone onBack={vi.fn()} />);
    expect(await screen.findByText(DESKTOP_ONLY_REPORTS)).toBeInTheDocument();
    expect(screen.queryByText(PHONE_ONLY_REPORTS)).toBeNull();
  });

  it("carregando: 'Voltar' já está lá", async () => {
    vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockReturnValue(new Promise(() => {}));
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<AnonymousReportStep onBack={onBack} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
