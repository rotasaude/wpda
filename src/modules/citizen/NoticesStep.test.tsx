// src/modules/citizen/NoticesStep.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoticesStep, EMPTY_NOTICES } from "./NoticesStep";
import { citizenApi, ApiError, type Notice } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-09-29T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const unread: Notice = {
  id: "r1", title: "Vacinação contra a gripe", body: "Leve a carteirinha.\nAté sexta.",
  dispatched_at: "2026-09-28T13:00:00-03:00", read: false, cpf_masked: null
};
const read: Notice = {
  id: "r2", title: "Mutirão de exames", body: "Sábado, das 8h às 12h.",
  dispatched_at: "2026-09-20T09:00:00-03:00", read: true, cpf_masked: null
};

function setup(notices: Notice[] = [ unread, read ]) {
  const list = vi.spyOn(citizenApi, "notices")
    .mockResolvedValue({ notices, unread_count: notices.filter(n => !n.read).length });
  const markRead = vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
  const onBack = vi.fn();
  const onPreferences = vi.fn();
  render(<NoticesStep onBack={onBack} onPreferences={onPreferences} />);
  return { list, markRead, onBack, onPreferences };
}

const item = (name: RegExp) => screen.findByRole("button", { name });

describe("NoticesStep — lista", () => {
  it("mostra título, data e 'novo' só no não lido; com uma pessoa no telefone, sem CPF", async () => {
    setup();
    const first = await item(/Vacinação contra a gripe/);
    expect(within(first).getByText("novo")).toBeInTheDocument();
    expect(within(first).getByText("28/09/2026")).toBeInTheDocument();
    const second = screen.getByRole("button", { name: /Mutirão de exames/ });
    expect(within(second).queryByText("novo")).not.toBeInTheDocument();
    expect(within(second).getByText("20/09/2026")).toBeInTheDocument();
    expect(screen.queryByText(/CPF/)).not.toBeInTheDocument();
  });

  it("mantém a ordem da API (mais novo primeiro)", async () => {
    setup();
    await item(/Vacinação/);
    const items = screen.getAllByRole("listitem").map(li => li.textContent);
    expect(items[0]).toMatch(/Vacinação/);
    expect(items[1]).toMatch(/Mutirão/);
  });

  it("vazio: mensagem própria, sem lista", async () => {
    setup([]);
    expect(await screen.findByText(EMPTY_NOTICES)).toBeInTheDocument();
    expect(EMPTY_NOTICES).toBe("Nenhum aviso da Secretaria por enquanto.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("várias pessoas no telefone: cada aviso diz o CPF mascarado de quem é", async () => {
    setup([
      { ...unread, cpf_masked: "***.982.247-**" },
      { ...read, cpf_masked: "***.111.222-**" }
    ]);
    expect(within(await item(/Vacinação/)).getByText("Para o CPF ***.982.247-**")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Mutirão/ })).getByText("Para o CPF ***.111.222-**"))
      .toBeInTheDocument();
  });

  it("alvo de toque com pelo menos 48 px e texto com pelo menos 18 px", async () => {
    setup();
    const b = await item(/Vacinação/);
    expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    expect(parseInt(b.style.fontSize, 10)).toBeGreaterThanOrEqual(18);
  });

  it("erro ao carregar: mensagem e 'Tentar de novo' recarrega", async () => {
    const list = vi.spyOn(citizenApi, "notices")
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue({ notices: [ unread ], unread_count: 1 });
    render(<NoticesStep onBack={vi.fn()} />);
    expect(await screen.findByText("Sem conexão. Verifique a internet e tente de novo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await item(/Vacinação/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("rodapé: 'Preferências de avisos' e 'Voltar ao início'", async () => {
    const { onBack, onPreferences } = setup();
    await item(/Vacinação/);
    await userEvent.click(screen.getByRole("button", { name: "Preferências de avisos" }));
    expect(onPreferences).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("sem onPreferences, não mostra o botão de preferências", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ unread ], unread_count: 1 });
    render(<NoticesStep onBack={vi.fn()} />);
    await item(/Vacinação/);
    expect(screen.queryByRole("button", { name: "Preferências de avisos" })).not.toBeInTheDocument();
  });
});

describe("NoticesStep — abrir um aviso", () => {
  it("tocar abre o texto completo, marca lido uma vez e, ao voltar, o aviso não é mais 'novo'", async () => {
    const { markRead, list } = setup();
    await userEvent.click(await item(/Vacinação/));

    expect(screen.getByRole("heading", { name: "Vacinação contra a gripe" })).toBeInTheDocument();
    expect(screen.getByText("28/09/2026")).toBeInTheDocument();
    expect(markRead).toHaveBeenCalledWith("r1");

    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    const first = await item(/Vacinação/);
    await waitFor(() => expect(within(first).queryByText("novo")).not.toBeInTheDocument());
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1); // voltar não recarrega
  });

  it("leitura bem-sucedida avisa o Flow (onRead) uma vez; aviso já lido não avisa", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ unread, read ], unread_count: 1 });
    vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
    const onRead = vi.fn();
    render(<NoticesStep onBack={vi.fn()} onRead={onRead} />);
    await userEvent.click(await item(/Vacinação/));
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    await userEvent.click(await item(/Mutirão/));
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it("falha ao marcar lido não avisa o Flow", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ unread ], unread_count: 1 });
    const markRead = vi.spyOn(citizenApi, "readNotice").mockRejectedValue(new TypeError("offline"));
    const onRead = vi.fn();
    render(<NoticesStep onBack={vi.fn()} onRead={onRead} />);
    await userEvent.click(await item(/Vacinação/));
    await waitFor(() => expect(markRead).toHaveBeenCalled());
    expect(onRead).not.toHaveBeenCalled();
  });

  it("quebras de linha preservadas", async () => {
    setup();
    await userEvent.click(await item(/Vacinação/));
    const body = screen.getByText(/Leve a carteirinha/);
    expect(body.textContent).toBe("Leve a carteirinha.\nAté sexta.");
    expect(body).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("texto com HTML aparece como texto", async () => {
    setup([ { ...unread, body: "<b>Atenção</b>\n<script>alert(1)</script>" } ]);
    await userEvent.click(await item(/Vacinação/));
    expect(screen.getByText(/<b>Atenção<\/b>/)).toBeInTheDocument();
    expect(document.querySelector("main b")).toBeNull();
    expect(document.querySelector("main script")).toBeNull();
  });

  it("aviso já lido abre sem chamar o POST", async () => {
    const { markRead } = setup();
    await userEvent.click(await item(/Mutirão/));
    expect(screen.getByText("Sábado, das 8h às 12h.")).toBeInTheDocument();
    expect(markRead).not.toHaveBeenCalled();
  });

  it("abrir de novo antes da resposta não repete o POST", async () => {
    const { markRead } = setup();
    markRead.mockReturnValue(new Promise<{ ok: boolean }>(() => {}));
    await userEvent.click(await item(/Vacinação/));
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    await userEvent.click(await item(/Vacinação/));
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it("falha ao marcar lido: o texto aparece sem erro, o aviso segue 'novo' e a próxima abertura tenta de novo", async () => {
    const { markRead } = setup();
    markRead.mockRejectedValue(new ApiError(404, "not_found"));
    await userEvent.click(await item(/Vacinação/));

    expect(screen.getByText(/Leve a carteirinha/)).toBeInTheDocument();
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Voltar aos avisos" }));
    expect(within(await item(/Vacinação/)).getByText("novo")).toBeInTheDocument();

    await userEvent.click(await item(/Vacinação/));
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(2));
  });
});
