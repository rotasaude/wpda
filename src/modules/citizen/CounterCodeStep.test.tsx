import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CounterCodeStep } from "./CounterCodeStep";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("CounterCodeStep", () => {
  it("mostra o código, a instrução e a contagem, e gera outro", async () => {
    const issue = vi.fn()
      .mockResolvedValueOnce({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() })
      .mockResolvedValueOnce({ code: "654321", expires_at: new Date(Date.now() + 600_000).toISOString() });
    render(<CounterCodeStep title="Validar no posto" instruction="Mostre este código e um documento com foto ao atendente." issue={issue} onBack={vi.fn()} />);
    expect(await screen.findByText("123456")).toBeInTheDocument();
    expect(screen.getByText("Mostre este código e um documento com foto ao atendente.")).toBeInTheDocument();
    expect(screen.getByText(/1\d:\d\d|10:00|9:\d\d/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gerar outro código" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("654321")).toBeInTheDocument();
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it("desabilita 'Gerar outro código' durante a requisição", async () => {
    let resolveNext: (v: { code: string; expires_at: string }) => void = () => {};
    const issue = vi.fn()
      .mockResolvedValueOnce({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() })
      .mockReturnValueOnce(new Promise((r) => { resolveNext = r; }));
    render(<CounterCodeStep title="Validar no posto" instruction="i" issue={issue} onBack={vi.fn()} />);
    const gerar = await screen.findByRole("button", { name: "Gerar outro código" }) as HTMLButtonElement;
    expect(gerar.disabled).toBe(false);

    fireEvent.click(gerar);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((screen.getByRole("button", { name: "Gerar outro código" }) as HTMLButtonElement).disabled).toBe(true);

    resolveNext({ code: "999999", expires_at: new Date(Date.now() + 600_000).toISOString() });
    await screen.findByText("999999");
    expect((screen.getByRole("button", { name: "Gerar outro código" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("duas emissões rápidas: a resposta do pedido mais antigo é ignorada se chegar depois", async () => {
    let resolveA: (v: { code: string; expires_at: string }) => void = () => {};
    let resolveB: (v: { code: string; expires_at: string }) => void = () => {};
    const issueA = vi.fn().mockReturnValueOnce(new Promise((r) => { resolveA = r; }));
    const issueB = vi.fn().mockReturnValueOnce(new Promise((r) => { resolveB = r; }));
    const { rerender } = render(<CounterCodeStep title="t" instruction="i" issue={issueA} onBack={vi.fn()} />);
    // Troca a função issue (ex.: navegação rápida) antes do pedido A responder: dispara o pedido B, mais recente.
    rerender(<CounterCodeStep title="t" instruction="i" issue={issueB} onBack={vi.fn()} />);

    // B (o mais recente) resolve primeiro; A resolve depois e deve ser ignorado.
    resolveB({ code: "222222", expires_at: new Date(Date.now() + 600_000).toISOString() });
    await screen.findByText("222222");
    resolveA({ code: "111111", expires_at: new Date(Date.now() + 600_000).toISOString() });
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText("222222")).toBeInTheDocument();
    expect(screen.queryByText("111111")).toBeNull();
  });

  it("código vencido mostra o aviso e deixa gerar outro", async () => {
    const issue = vi.fn().mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() - 1000).toISOString() });
    render(<CounterCodeStep title="t" instruction="i" issue={issue} onBack={vi.fn()} />);
    expect(await screen.findByText("Este código venceu.")).toBeInTheDocument();
  });

  it("mostra o título recebido", async () => {
    const issue = vi.fn().mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() });
    render(<CounterCodeStep title="Cheguei na unidade" instruction="i" issue={issue} onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Cheguei na unidade" })).toBeInTheDocument();
  });

  describe("usabilidade (6e, WP-15)", () => {
    const valid = () => ({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() });

    it("com o código válido não há ação principal; gerar outro é secundário e pede confirmação", async () => {
      const issue = vi.fn().mockResolvedValueOnce(valid()).mockResolvedValueOnce({ ...valid(), code: "654321" });
      render(<CounterCodeStep title="t" instruction="i" issue={issue} onBack={vi.fn()} />);
      const gerar = await screen.findByRole("button", { name: "Gerar outro código" });
      expect(gerar.style.background).toBe("transparent");
      await userEvent.click(gerar);
      expect(screen.getByText("Gerar outro código? O código de agora deixa de valer.")).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByText("Gerar outro código? O código de agora deixa de valer."));
      expect(issue).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(issue).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Gerar outro código" }));
    });

    it("código vencido: gerar outro vira principal e não pede confirmação", async () => {
      const issue = vi.fn().mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() - 1000).toISOString() });
      render(<CounterCodeStep title="t" instruction="i" issue={issue} onBack={vi.fn()} />);
      await screen.findByText("Este código venceu.");
      const gerar = screen.getByRole("button", { name: "Gerar outro código" });
      expect(gerar.style.background).toBe("var(--accent)");
      await userEvent.click(gerar);
      expect(issue).toHaveBeenCalledTimes(2);
    });

    it("vencer com a confirmação aberta fecha a confirmação", async () => {
      vi.useFakeTimers({ toFake: [ "Date", "setTimeout", "clearTimeout" ] });
      const issue = vi.fn().mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() + 2000).toISOString() });
      render(<CounterCodeStep title="t" instruction="i" issue={issue} onBack={vi.fn()} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole("button", { name: "Gerar outro código" }));
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
      for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.getByText("Este código venceu.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
      expect(screen.getByRole("button", { name: "Gerar outro código" }).style.background).toBe("var(--accent)");
    });
  });
});
