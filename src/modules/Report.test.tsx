import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Report } from "./Report";
import { GENERIC_NOTE } from "../lib/report";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function json(status: number, body?: unknown) {
  return async () => new Response(
    body !== undefined ? JSON.stringify(body) : "",
    { status, headers: { "Content-Type": "application/json" } }
  );
}

const frozen = {
  tier: "alta",
  priority: "1",
  recommendation: { title: "Procure a UPA hoje", body: "Leve um documento com foto." },
  summary: [ { step: "febre", answer: "sim" } ],
  completed_at: "2026-09-20T15:30:00Z",
  expires_at: "2026-10-20T15:30:00Z"
};

describe("Report", () => {
  it("busca GET /r/:token com o token codificado", async () => {
    const fetchMock = stubFetch(json(200, frozen));
    render(<Report token="a b/c" />);

    await screen.findByText("Seu resultado");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("/r/a%20b%2Fc");
  });

  it("mostra carregando enquanto a resposta não chega", () => {
    stubFetch(() => new Promise<Response>(() => {}));
    render(<Report token="abc" />);

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("renderiza tier, prioridade, recomendação e datas do snapshot", async () => {
    stubFetch(json(200, frozen));
    render(<Report token="abc" />);

    expect(await screen.findByText("alta")).toBeInTheDocument();
    expect(screen.getByText("prioridade: 1")).toBeInTheDocument();
    expect(screen.getByText("Procure a UPA hoje")).toBeInTheDocument();
    expect(screen.getByText("Leve um documento com foto.")).toBeInTheDocument();
    // Datas no fuso da cidade (America/Sao_Paulo, UTC-3).
    expect(screen.getByText("Realizado em 20/09/2026, 12:30.")).toBeInTheDocument();
    expect(screen.getByText("Válido até 20/10/2026, 12:30.")).toBeInTheDocument();
    expect(screen.getByText(/não compartilhe este link/)).toBeInTheDocument();
  });

  it("sem recomendação, mostra a nota genérica e omite tier/prioridade/datas ausentes", async () => {
    stubFetch(json(200, {
      tier: null, priority: null, recommendation: null, summary: null,
      completed_at: null, expires_at: null
    }));
    render(<Report token="abc" />);

    expect(await screen.findByText(GENERIC_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(/prioridade:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Realizado em/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Válido até/)).not.toBeInTheDocument();
  });

  it("não exibe a trilha (summary) que a API devolve", async () => {
    // Registra o comportamento atual: summary vem no JSON mas a tela não o mostra.
    stubFetch(json(200, frozen));
    render(<Report token="abc" />);

    await screen.findByText("Seu resultado");
    expect(screen.queryByText("febre")).not.toBeInTheDocument();
  });

  it("404 (token inválido ou expirado) mostra Link inválido", async () => {
    stubFetch(json(404));
    render(<Report token="expirado" />);

    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
    expect(screen.getByText("Este link é inválido ou expirou.")).toBeInTheDocument();
    expect(screen.queryByText("Seu resultado")).not.toBeInTheDocument();
  });

  it("500 mostra o erro genérico, não Link inválido", async () => {
    stubFetch(json(500));
    render(<Report token="abc" />);

    expect(await screen.findByText("Não foi possível carregar. Tente novamente.")).toBeInTheDocument();
    expect(screen.queryByText("Link inválido")).not.toBeInTheDocument();
  });

  it("falha de rede mostra o erro genérico", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    render(<Report token="abc" />);

    expect(await screen.findByText("Não foi possível carregar. Tente novamente.")).toBeInTheDocument();
  });
});
