import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Flow } from "./Flow";
import { citizenApi, ApiError } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

describe("Flow", () => {
  it("sem sessão, começa pelo telefone", async () => {
    vi.spyOn(citizenApi, "currentSession").mockRejectedValue(new ApiError(401, "unauthenticated"));
    render(<Flow />);
    expect(await screen.findByLabelText("Seu celular")).toBeInTheDocument();
  });

  it("com sessão, vai direto ao termo", async () => {
    vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
    render(<Flow />);
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("sessão expirada (evento citizen:unauthenticated) volta para o telefone", async () => {
    vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
    vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
    render(<Flow />);
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("citizen:unauthenticated")));

    expect(await screen.findByLabelText("Seu celular")).toBeInTheDocument();
  });
});
