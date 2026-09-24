import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("código vencido mostra o aviso e deixa gerar outro", async () => {
    vi.spyOn(citizenApi, "issueVerificationCode")
      .mockResolvedValue({ code: "123456", expires_at: new Date(Date.now() - 1000).toISOString() });
    render(<VerificationCodeStep citizenId="p1" onBack={vi.fn()} />);
    expect(await screen.findByText("Este código venceu.")).toBeInTheDocument();
  });
});
