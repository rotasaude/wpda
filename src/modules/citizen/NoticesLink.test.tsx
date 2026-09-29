// src/modules/citizen/NoticesLink.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NoticesLink, badgeText } from "./NoticesLink";
import { citizenApi, ApiError } from "../../lib/citizenApi";

beforeEach(() => vi.stubEnv("BASE_URL", "/wpda/"));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("badgeText", () => {
  it.each([ [ 0, null ], [ -1, null ], [ Number.NaN, null ], [ 1, "1" ], [ 99, "99" ], [ 100, "99+" ] ])(
    "%s → %s", (count, text) => expect(badgeText(count)).toBe(text));
});

describe("NoticesLink", () => {
  it("mostra o selo com os não lidos e aponta para <base>avisos", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 3 });
    render(<NoticesLink onOpen={vi.fn()} />);
    const link = await screen.findByRole("link", { name: "Avisos, 3 novos" });
    expect(link).toHaveAttribute("href", "/wpda/avisos");
    expect(within(link).getByText("3")).toBeInTheDocument();
    expect(parseInt(link.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    expect(parseInt(link.style.fontSize, 10)).toBeGreaterThanOrEqual(18);
  });

  it("um não lido: singular", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 1 });
    render(<NoticesLink onOpen={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Avisos, 1 novo" })).toBeInTheDocument();
  });

  it("mais de 99: selo '99+', nome com o número real", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 150 });
    render(<NoticesLink onOpen={vi.fn()} />);
    const link = await screen.findByRole("link", { name: "Avisos, 150 novos" });
    expect(within(link).getByText("99+")).toBeInTheDocument();
  });

  it("zero (inclusive quando todos silenciaram): sem selo", async () => {
    const notices = vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
    render(<NoticesLink onOpen={vi.fn()} />);
    await waitFor(() => expect(notices).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Avisos" }).textContent).toBe("Avisos");
  });

  it("falha ao buscar (api antiga ou rede): link sem selo e sem erro", async () => {
    const notices = vi.spyOn(citizenApi, "notices").mockRejectedValue(new ApiError(404, "not_found"));
    render(<NoticesLink onOpen={vi.fn()} />);
    await waitFor(() => expect(notices).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Avisos" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tocar abre a caixa sem recarregar a página", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
    const onOpen = vi.fn();
    render(<NoticesLink onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "Avisos" });
    expect(fireEvent.click(link)).toBe(false); // preventDefault
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
