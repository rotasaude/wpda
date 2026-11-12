// src/modules/citizen/NoticesStep.ombudsman.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoticesStep } from "./NoticesStep";
import { citizenApi, type Notice } from "../../lib/citizenApi";

beforeEach(() => { vi.useFakeTimers({ toFake: [ "Date" ] }); vi.setSystemTime(new Date("2026-11-12T10:00:00-03:00")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const N: Notice = { kind: "ombudsman", id: "o1", event: "final_response", protocol: "2026-000123",
  created_at: "2026-11-11T14:00:00-03:00", read: false, cpf_masked: "***.982.247-**" };

describe("NoticesStep — aviso da Ouvidoria (módulo 33)", () => {
  it("item: título do evento, protocolo, data, CPF e novo; abre, marca lido e leva às manifestações", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ N, { ...N, id: "o2", event: "xpto", protocol: null, read: true, cpf_masked: null } ], unread_count: 1 });
    const read = vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
    const onOmbudsman = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NoticesStep onBack={vi.fn()} onOmbudsman={onOmbudsman} />);
    const item = await screen.findByRole("button", { name: /Sua manifestação foi respondida/ });
    expect(item).toHaveTextContent("Protocolo 2026-000123");
    expect(item).toHaveTextContent("11/11/2026");
    expect(item).toHaveTextContent("Para o CPF ***.982.247-**");
    expect(item).toHaveTextContent("novo");
    expect(screen.getByRole("button", { name: /Aviso da Ouvidoria/ })).not.toHaveTextContent("Protocolo");
    await user.click(item);
    expect(await screen.findByRole("heading", { level: 1, name: "Sua manifestação foi respondida" })).toBeInTheDocument();
    expect(screen.getByText('Os detalhes estão em "Minhas manifestações", na Ouvidoria.')).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith("o1");
    await user.click(screen.getByRole("button", { name: "Ver minhas manifestações" }));
    expect(onOmbudsman).toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("sem onOmbudsman (interruptor desligado): sem o botão", async () => {
    vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [ N ], unread_count: 1 });
    vi.spyOn(citizenApi, "readNotice").mockResolvedValue({ ok: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<NoticesStep onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /Sua manifestação foi respondida/ }));
    expect(screen.queryByRole("button", { name: "Ver minhas manifestações" })).toBeNull();
  });
});
