// src/modules/citizen/Flow.notices.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type Notice } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-09-29T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

const notice: Notice = {
  id: "r1", title: "Vacinação contra a gripe", body: "Leve a carteirinha.",
  dispatched_at: "2026-09-28T13:00:00-03:00", read: false, cpf_masked: null
};

function signedIn() {
  vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({
    people: [{ id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared" }]
  });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
}

// Estado do api simulado: um aviso; ler (ou silenciar, na Task 4) zera o selo.
function inbox() {
  const box = { unread: 1 };
  const notices = vi.spyOn(citizenApi, "notices").mockImplementation(async () => ({
    notices: [ { ...notice, read: box.unread === 0 } ], unread_count: box.unread
  }));
  const readNotice = vi.spyOn(citizenApi, "readNotice").mockImplementation(async () => {
    box.unread = 0;
    return { ok: true };
  });
  return { box, notices, readNotice };
}

const bar = () => screen.getByRole("navigation", { name: "Conta" });

describe("Flow — link Avisos no topo", () => {
  it("aparece ao lado de Sair na tela do termo e na tela de pessoas", async () => {
    signedIn();
    inbox();
    render(<Flow />);

    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
    expect(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" })).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Sair" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Concordo" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
    expect(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" })).toBeInTheDocument();
  });

  it("sem sessão (carregando, celular, código) não há link nem barra", async () => {
    vi.spyOn(citizenApi, "currentSession").mockRejectedValue(new ApiError(401, "unauthenticated"));
    vi.spyOn(citizenApi, "requestCode").mockResolvedValue({ status: "sent", resend_after: 60 });
    const notices = vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 1 });
    render(<Flow />);

    expect(screen.queryByRole("navigation", { name: "Conta" })).not.toBeInTheDocument(); // boot
    await userEvent.type(await screen.findByLabelText("Seu celular"), "41998765432");
    expect(screen.queryByRole("link", { name: /Avisos/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Receber código" }));
    expect(await screen.findByLabelText("Código")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Avisos/ })).not.toBeInTheDocument();
    expect(notices).not.toHaveBeenCalled();
  });

  it("da tela de pessoas: abre a caixa, ler tira o selo do topo na hora, e voltar volta às pessoas", async () => {
    signedIn();
    const { readNotice } = inbox();
    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await screen.findByText("Para quem é esta triagem?");
    await userEvent.click(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" }));

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Vacinação/ }));
    await waitFor(() => expect(readNotice).toHaveBeenCalledWith("r1"));
    // Ainda no texto do aviso, o selo do topo já foi relido.
    expect(await within(bar()).findByRole("link", { name: "Avisos" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
    expect(within(bar()).getByRole("link", { name: "Avisos" }).textContent).toBe("Avisos");
  });

  it("da tela do termo: a caixa abre sem aceitar o termo, e voltar leva ao termo", async () => {
    signedIn();
    inbox();
    render(<Flow />);
    await screen.findByRole("button", { name: "Concordo" });
    await userEvent.click(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" }));

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("api sem a rota de avisos: o topo mostra o link sem selo, sem erro, e a triagem segue", async () => {
    signedIn();
    vi.spyOn(citizenApi, "notices").mockRejectedValue(new ApiError(404, "not_found"));
    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));

    expect(await screen.findByRole("button", { name: "CPF ***.982.247-**" })).toBeInTheDocument();
    expect(within(bar()).getByRole("link", { name: "Avisos" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("silenciar nas preferências tira o selo do topo na hora; os avisos continuam na lista como 'novo'", async () => {
    signedIn();
    const { box } = inbox();
    vi.spyOn(citizenApi, "contactPreferences").mockResolvedValue({
      sms_available: false,
      people: [ { citizen_id: "p1", cpf_masked: "***.982.247-**", sms_opt_in: false, notices_muted: false } ]
    });
    // Silenciar zera o selo no api, mas o aviso continua não lido.
    const update = vi.spyOn(citizenApi, "updateContactPreference").mockImplementation(async () => {
      box.unread = 0;
      return { citizen_id: "p1", cpf_masked: "***.982.247-**", sms_opt_in: false, notices_muted: true };
    });
    vi.mocked(citizenApi.notices).mockImplementation(async () => ({
      notices: [ notice ], unread_count: box.unread
    }));

    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await userEvent.click(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" }));
    await userEvent.click(await screen.findByRole("button", { name: "Preferências de avisos" }));

    expect(await screen.findByRole("heading", { name: "Preferências de avisos" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("switch", { name: "Silenciar avisos" }));
    expect(update).toHaveBeenCalledWith("p1", { notices_muted: true });
    expect(await screen.findByText("Preferência salva.")).toBeInTheDocument();
    // Ainda nas preferências, o selo do topo já foi relido.
    expect(await within(bar()).findByRole("link", { name: "Avisos" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    expect(within(await screen.findByRole("button", { name: /Vacinação/ })).getByText("novo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
    expect(within(bar()).getByRole("link", { name: "Avisos" }).textContent).toBe("Avisos");
  });

  it("tocar em Avisos no topo com um aviso aberto volta à lista", async () => {
    signedIn();
    inbox();
    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await userEvent.click(await within(bar()).findByRole("link", { name: "Avisos, 1 novo" }));
    await userEvent.click(await screen.findByRole("button", { name: /Vacinação/ }));
    expect(await screen.findByRole("button", { name: "Voltar aos avisos" })).toBeInTheDocument();

    await userEvent.click(await within(bar()).findByRole("link", { name: "Avisos" }));

    expect(await screen.findByRole("heading", { name: "Avisos" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Vacinação/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar aos avisos" })).not.toBeInTheDocument();
  });
});
