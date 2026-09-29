// src/modules/citizen/Flow.route.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type Notice } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-09-29T10:00:00-03:00"));
  vi.stubEnv("BASE_URL", "/wpda/");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const notice: Notice = {
  id: "r1", title: "Vacinação contra a gripe", body: "Leve a carteirinha.",
  dispatched_at: "2026-09-28T13:00:00-03:00", read: false, cpf_masked: null
};

function at(path: string) {
  window.history.replaceState(null, "", path);
}

function api({ session }: { session: boolean }) {
  const currentSession = session
    ? vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" })
    : vi.spyOn(citizenApi, "currentSession").mockRejectedValue(new ApiError(401, "unauthenticated"));
  const term = vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({
    people: [{ id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }]
  });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
  vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ notice ], unread_count: 1 });
  vi.spyOn(citizenApi, "contactPreferences").mockResolvedValue({ sms_available: false, people: [] });
  vi.spyOn(citizenApi, "requestCode").mockResolvedValue({ status: "sent", resend_after: 60 });
  vi.spyOn(citizenApi, "verifyCode").mockResolvedValue({ phone_masked: "(**) *****-5432" });
  vi.spyOn(citizenApi, "signOut").mockResolvedValue(undefined);
  return { currentSession, term };
}

async function signIn() {
  await userEvent.type(await screen.findByLabelText("Seu celular"), "41998765432");
  await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
  await userEvent.type(await screen.findByLabelText("Código"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
}

describe("Flow — link do SMS (/avisos)", () => {
  it("sem sessão: passa pelo login e volta à caixa de avisos, sem o termo", async () => {
    at("/wpda/avisos");
    const { term } = api({ session: false });
    render(<Flow />);

    await signIn();

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Vacinação/ })).toBeInTheDocument();
    expect(term).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/wpda/avisos");
  });

  it("durante o login, a URL pedida fica (F5 no código volta ao mesmo destino)", async () => {
    at("/wpda/avisos");
    api({ session: false });
    render(<Flow />);
    await userEvent.type(await screen.findByLabelText("Seu celular"), "41998765432");
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    await screen.findByLabelText("Código");
    expect(window.location.pathname).toBe("/wpda/avisos");
  });

  it("com sessão: abre a caixa direto; 'Voltar ao início' leva ao termo e a URL volta à base", async () => {
    at("/wpda/avisos/");
    const { term } = api({ session: true });
    render(<Flow />);

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    expect(term).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));

    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/wpda/"));
  });

  it("/preferencias com sessão abre as preferências", async () => {
    at("/wpda/preferencias");
    api({ session: true });
    render(<Flow />);
    expect(await screen.findByRole("heading", { name: "Preferências de avisos" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/wpda/preferencias");
  });

  it("caminho desconhecido segue o fluxo de sempre (termo)", async () => {
    at("/wpda/qualquer");
    api({ session: true });
    render(<Flow />);
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/wpda/"));
  });

  it("sessão cai (401) na caixa: login de novo e volta à caixa", async () => {
    at("/wpda/avisos");
    const { term } = api({ session: true });
    render(<Flow />);
    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("citizen:unauthenticated")));
    await signIn();

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    expect(term).not.toHaveBeenCalled();
  });

  it("sessão cai (401) nas preferências: volta às preferências", async () => {
    at("/wpda/preferencias");
    api({ session: true });
    render(<Flow />);
    expect(await screen.findByRole("heading", { name: "Preferências de avisos" })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("citizen:unauthenticated")));
    await signIn();

    expect(await screen.findByRole("heading", { name: "Preferências de avisos" })).toBeInTheDocument();
  });

  it("'Sair' esquece o destino: o próximo login abre o termo e a URL fica na base", async () => {
    at("/wpda/avisos");
    api({ session: true });
    render(<Flow />);
    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(await screen.findByLabelText("Seu celular")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/wpda/");
    expect(screen.queryByRole("link", { name: /Avisos/ })).not.toBeInTheDocument();

    await signIn();
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("abrir Avisos pela tela inicial põe /avisos na URL", async () => {
    at("/wpda/");
    api({ session: true });
    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await screen.findByText("Para quem é esta triagem?");
    await userEvent.click(await screen.findByRole("link", { name: /^Avisos/ }));

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/wpda/avisos"));
  });
});
