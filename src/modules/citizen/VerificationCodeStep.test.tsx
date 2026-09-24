import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationCodeStep } from "./VerificationCodeStep";
import { citizenApi } from "../../lib/citizenApi";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("VerificationCodeStep", () => {
  it("mostra o código, a instrução e a contagem, e gera outro", async () => {
    const spy = vi.spyOn(citizenApi, "issueVerificationCode")
      .mockResolvedValueOnce({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() })
      .mockResolvedValueOnce({ code: "654321", expires_at: new Date(Date.now() + 600_000).toISOString() });
    render(<VerificationCodeStep citizenId="p1" onBack={vi.fn()} />);
    expect(await screen.findByText("123456")).toBeInTheDocument();
    expect(screen.getByText("Mostre este código e um documento com foto ao atendente.")).toBeInTheDocument();
    expect(screen.getByText(/1\d:\d\d|10:00|9:\d\d/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gerar outro código" }));
    expect(await screen.findByText("654321")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("p1");
  });

  it("desabilita 'Gerar outro código' durante a requisição", async () => {
    let resolveNext: (v: { code: string; expires_at: string }) => void = () => {};
    vi.spyOn(citizenApi, "issueVerificationCode")
      .mockResolvedValueOnce({ code: "123456", expires_at: new Date(Date.now() + 600_000).toISOString() })
      .mockReturnValueOnce(new Promise((r) => { resolveNext = r; }));
    render(<VerificationCodeStep citizenId="p1" onBack={vi.fn()} />);
    const gerar = await screen.findByRole("button", { name: "Gerar outro código" }) as HTMLButtonElement;
    expect(gerar.disabled).toBe(false);

    fireEvent.click(gerar);
    expect(gerar.disabled).toBe(true);

    resolveNext({ code: "999999", expires_at: new Date(Date.now() + 600_000).toISOString() });
    await screen.findByText("999999");
    expect(gerar.disabled).toBe(false);
  });

  it("duas emissões rápidas: a resposta do pedido mais antigo é ignorada se chegar depois", async () => {
    let resolveA: (v: { code: string; expires_at: string }) => void = () => {};
    let resolveB: (v: { code: string; expires_at: string }) => void = () => {};
    vi.spyOn(citizenApi, "issueVerificationCode")
      .mockReturnValueOnce(new Promise((r) => { resolveA = r; })) // pedido A: emissão inicial (citizenId p1)
      .mockReturnValueOnce(new Promise((r) => { resolveB = r; })); // pedido B: citizenId trocou antes de A responder
    const { rerender } = render(<VerificationCodeStep citizenId="p1" onBack={vi.fn()} />);
    // Troca o citizenId (ex.: navegação rápida) antes do pedido A responder: dispara o pedido B, mais recente.
    rerender(<VerificationCodeStep citizenId="p2" onBack={vi.fn()} />);

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
    vi.spyOn(citizenApi, "issueVerificationCode")
      .mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() - 1000).toISOString() });
    render(<VerificationCodeStep citizenId="p1" onBack={vi.fn()} />);
    expect(await screen.findByText("Este código venceu.")).toBeInTheDocument();
  });
});
