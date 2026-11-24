// src/modules/citizen/Flow.ombudsman.test.tsx
// Módulo 33 (contrato §14; U1, U2, Q1, Q39, Q45): a Ouvidoria na máquina de telas, sem e com sessão.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type CitizenManifestation, type CitizenManifestationSummary } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00"));
  vi.stubEnv("BASE_URL", "/wpda/");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); setSessionFeatures(null); window.history.replaceState(null, "", "/"); });

const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" as const, neighborhood: null, profile: null };
const ITEM: CitizenManifestationSummary = { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "identified",
  state: "in_analysis", received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "green", cpf_masked: null, has_unread: true };
const DETAIL: CitizenManifestation = { id: "m1", protocol: "2026-000123", kind: "complaint", identification_mode: "identified",
  state: "in_analysis", received_at: "2026-11-10T09:00:00-03:00", due_on: "2026-12-10", color: "green", body: "Esperei quatro horas.",
  health_unit: null, attachments: [], timeline: [ { kind: "received", at: "2026-11-10T09:00:00-03:00", text: null } ],
  can_complement: false, can_request_reopen: false, can_answer_satisfaction: false };

function api({ session, features = [ "ombudsman", "ombudsman_anonymous_web" ], anonymous = true, publicConfig = true }:
  { session: boolean; features?: string[]; anonymous?: boolean; publicConfig?: boolean }) {
  const sessionOk = async () => { setSessionFeatures(features); return { phone_masked: "(**) *****-5432", features }; };
  if (session) vi.spyOn(citizenApi, "currentSession").mockImplementation(sessionOk);
  else vi.spyOn(citizenApi, "currentSession").mockRejectedValue(new ApiError(401, "unauthenticated"));
  vi.spyOn(citizenApi, "requestCode").mockResolvedValue({ status: "sent", resend_after: 60 });
  vi.spyOn(citizenApi, "verifyCode").mockImplementation(async () => sessionOk());
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ PERSON ] });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
  const notices = vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
  // Q1: interruptor desligado = 403 feature_disabled.
  const config = publicConfig
    ? vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockResolvedValue({ anonymous_web: anonymous, zoonoses: false, units: [] })
    : vi.spyOn(citizenApi, "ombudsmanPublicConfig").mockRejectedValue(new ApiError(403, "feature_disabled"));
  const list = vi.spyOn(citizenApi, "manifestations").mockResolvedValue([]);
  return { notices, list, config };
}

const opts = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

async function logIn(user: ReturnType<typeof opts>) {
  await user.type(screen.getByLabelText("Seu celular"), "41998765432");
  await user.click(screen.getByRole("button", { name: "Receber código" }));
  await user.type(await screen.findByLabelText("Código"), "123456");
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
}

describe("Flow — Ouvidoria (módulo 33)", () => {
  it("sem sessão: tela inicial com a Ouvidoria; anônima sem o topo da conta; Voltar ao início", async () => {
    const { notices } = api({ session: false });
    const user = opts();
    render(<Flow />);
    await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" });
    expect(await screen.findByRole("heading", { level: 2, name: "Ouvidoria" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Denúncia anônima" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Conta" })).toBeNull();
    expect(notices).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeInTheDocument();
  });

  it("public_config recusado (403): a tela inicial fica como hoje, sem a Ouvidoria", async () => {
    const { config } = api({ session: false, publicConfig: false });
    render(<Flow />);
    await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" });
    await waitFor(() => expect(config).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("heading", { level: 2, name: "Ouvidoria" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fazer uma manifestação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
    expect(screen.getByLabelText("Seu celular")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Receber código" })).toBeInTheDocument();
  });

  it("Fazer uma manifestação: entra com o celular e cai na Ouvidoria, sem o termo da triagem", async () => {
    const { list } = api({ session: false });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Fazer uma manifestação" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Ouvidoria" })).toBeInTheDocument();
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    expect(citizenApi.consentTerm).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalled();
    expect(window.location.pathname).toBe("/wpda/ouvidoria");
  });

  it("celular da Ouvidoria: frase própria, sem a entrada; Voltar esquece o destino e o login segue para o termo", async () => {
    api({ session: false });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Fazer uma manifestação" }));
    await screen.findByRole("heading", { level: 1, name: "Ouvidoria" });
    expect(screen.getByText("Para fazer uma manifestação, entre com o seu celular. Vamos mandar um código por SMS.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeInTheDocument();
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Antes de começar" })).toBeInTheDocument();
  });

  it("Trocar número no código mantém a tela da Ouvidoria", async () => {
    api({ session: false });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Fazer uma manifestação" }));
    await screen.findByRole("heading", { level: 1, name: "Ouvidoria" });
    await user.type(screen.getByLabelText("Seu celular"), "41998765432");
    await user.click(screen.getByRole("button", { name: "Receber código" }));
    await screen.findByLabelText("Código");
    await user.click(screen.getByRole("button", { name: "Trocar número" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Ouvidoria" })).toBeInTheDocument();
  });

  it("com sessão: Para quem é → Ouvidoria → Nova manifestação → Voltar", async () => {
    api({ session: true });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Concordo" }));
    await user.click(await screen.findByRole("button", { name: "Ouvidoria" }));
    await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" });
    expect(within(screen.getByRole("navigation", { name: "Conta" })).getByRole("button", { name: "Sair" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova manifestação" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Que tipo de manifestação?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Para quem é esta triagem?" })).toBeInTheDocument();
  });

  it("sem ombudsman na sessão: Para quem é igual", async () => {
    api({ session: true, features: [ "patient_timeline" ] });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Concordo" }));
    await screen.findByRole("heading", { level: 1, name: "Para quem é esta triagem?" });
    expect(screen.queryByRole("button", { name: "Ouvidoria" })).toBeNull();
  });

  it("recusa do termo: com ombudsman, Ouvidoria no rodapé; Voltar leva ao termo", async () => {
    api({ session: true });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Não concordo" }));
    await screen.findByRole("heading", { level: 1, name: "Tudo bem" });
    await user.click(screen.getByRole("button", { name: "Ouvidoria" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Antes de começar" })).toBeInTheDocument();
  });

  it("recusa do termo sem ombudsman na sessão: como hoje", async () => {
    api({ session: true, features: [ "patient_timeline" ] });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Não concordo" }));
    await screen.findByRole("heading", { level: 1, name: "Tudo bem" });
    expect(screen.getByRole("button", { name: "Ler o termo de novo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ouvidoria" })).toBeNull();
  });

  it("rota /wpda/ouvidoria com sessão: abre direto; sem anonymous na sessão, não há Denúncia anônima", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    api({ session: true, features: [ "ombudsman" ] });
    render(<Flow />);
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Denúncia anônima" })).toBeNull();
  });

  it("rota /wpda/ouvidoria sem ombudsman na sessão: o termo, como hoje", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    const { list } = api({ session: true, features: [ "patient_timeline" ] });
    render(<Flow />);
    expect(await screen.findByRole("heading", { level: 1, name: "Antes de começar" })).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/wpda/");
  });

  it("com sessão: Denúncia anônima da lista, com o topo da conta, volta à lista", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    api({ session: true });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Denúncia anônima" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Conta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
  });

  it("Denúncia anônima logada fica no endereço da Ouvidoria: um F5 volta à lista", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    api({ session: true });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Denúncia anônima" }));
    await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" });
    expect(window.location.pathname).toBe("/wpda/ouvidoria");
  });

  it("sessão cai na denúncia anônima logada: ao entrar de novo, a Ouvidoria", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    api({ session: true });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Denúncia anônima" }));
    await screen.findByRole("heading", { level: 1, name: "Denúncia anônima" });
    act(() => { window.dispatchEvent(new Event("citizen:unauthenticated")); });
    expect(await screen.findByRole("heading", { level: 1, name: "Ouvidoria" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeNull();
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    expect(citizenApi.consentTerm).not.toHaveBeenCalled();
  });

  it("Voltar no celular da Ouvidoria devolve o destino do link do SMS (avisos)", async () => {
    window.history.replaceState(null, "", "/wpda/avisos");
    api({ session: false });
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: "Fazer uma manifestação" }));
    await screen.findByRole("heading", { level: 1, name: "Ouvidoria" });
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" });
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Avisos" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/wpda/avisos");
  });

  it("detalhe: o id fica fora da URL, e a leitura relê o selo do topo (Q45)", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    const { notices, list } = api({ session: true });
    notices.mockResolvedValueOnce({ notices: [], unread_count: 1 }).mockResolvedValueOnce({ notices: [], unread_count: 1 });
    list.mockResolvedValue([ ITEM ]);
    let resolve: (d: CitizenManifestation) => void = () => {};
    const detail = vi.spyOn(citizenApi, "manifestation").mockReturnValue(new Promise(r => { resolve = r; }));
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: /protocolo 2026-000123/ }));
    expect(detail).toHaveBeenCalledWith("m1");
    expect(await screen.findByRole("link", { name: "Avisos, 1 novo" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/wpda/ouvidoria");
    expect(window.location.search).toBe("");
    await act(async () => { resolve(DETAIL); });
    expect(await screen.findByText("Esperei quatro horas.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Avisos" })).toBeInTheDocument();
    expect(notices).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole("button", { name: "Voltar às manifestações" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
  });

  it.each([
    [ "com ombudsman", [ "ombudsman", "ombudsman_anonymous_web" ], true ],
    [ "sem ombudsman", [ "ombudsman_anonymous_web" ], false ]
  ])("aviso da Ouvidoria (%s): Ver minhas manifestações leva à lista, e só existe com o interruptor", async (_n, features, offered) => {
    window.history.replaceState(null, "", "/wpda/avisos");
    const { notices, list } = api({ session: true, features });
    notices.mockResolvedValue({ unread_count: 1, notices: [ { kind: "ombudsman", id: "o1", event: "final_response", protocol: "2026-000123",
      created_at: "2026-11-11T14:00:00-03:00", read: false, cpf_masked: null } ] });
    vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
    list.mockResolvedValue([ ITEM ]);
    const user = opts();
    render(<Flow />);
    await user.click(await screen.findByRole("button", { name: /Sua manifestação foi respondida/ }));
    await screen.findByRole("heading", { level: 1, name: "Sua manifestação foi respondida" });
    if (!offered) {
      expect(screen.queryByRole("button", { name: "Ver minhas manifestações" })).toBeNull();
      expect(list).not.toHaveBeenCalled();
      return;
    }
    await user.click(screen.getByRole("button", { name: "Ver minhas manifestações" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /protocolo 2026-000123/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/wpda/ouvidoria");
  });

  it("sessão cai na Ouvidoria: volta ao celular e, ao entrar, à Ouvidoria", async () => {
    const { list } = api({ session: true });
    list.mockRejectedValueOnce(new ApiError(401, "unauthenticated"));
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    render(<Flow />);
    // F-13: o evento só depois do enter(), senão a sessão que resolve depois leva de volta à lista.
    await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" });
    act(() => { window.dispatchEvent(new Event("citizen:unauthenticated")); });
    // O login leva de volta à Ouvidoria: o título é o dela, não o da triagem.
    expect(await screen.findByRole("heading", { level: 1, name: "Ouvidoria" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeNull();
    expect(screen.getByText("Para fazer uma manifestação, entre com o seu celular. Vamos mandar um código por SMS.")).toBeInTheDocument();
    const user = opts();
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" })).toBeInTheDocument();
  });

  it("sessão cai na Ouvidoria e a pessoa desiste: Voltar leva à tela inicial e o login segue para o termo", async () => {
    window.history.replaceState(null, "", "/wpda/ouvidoria");
    api({ session: true });
    render(<Flow />);
    await screen.findByRole("heading", { level: 1, name: "Minhas manifestações" });
    act(() => { window.dispatchEvent(new Event("citizen:unauthenticated")); });
    await screen.findByRole("heading", { level: 1, name: "Ouvidoria" });
    const user = opts();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeInTheDocument();
    await logIn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Antes de começar" })).toBeInTheDocument();
  });
});
