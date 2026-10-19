import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CityHeader } from "./CityHeader";
import { resetCityIdentityForTests } from "../../lib/cityIdentity";

const ID = { name: "Curitiba", uf: "PR", time_zone: "America/Sao_Paulo", health_department_name: null, coat_of_arms_url: "/city_identity/coat_of_arms" };
const ok = () => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ID });
beforeEach(() => resetCityIdentityForTests());
afterEach(() => vi.unstubAllGlobals());

describe("CityHeader", () => {
  it("duas montagens fazem uma requisição só", async () => {
    const f = ok(); vi.stubGlobal("fetch", f);
    render(<><CityHeader /><CityHeader /></>);
    expect(await screen.findAllByText("Prefeitura de Curitiba")).toHaveLength(2);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("com identidade: brasão com alt e Prefeitura de <nome>", async () => {
    vi.stubGlobal("fetch", ok());
    render(<CityHeader />);
    expect(await screen.findByText("Prefeitura de Curitiba")).toBeInTheDocument();
    const img = screen.getByAltText("Brasão de Curitiba");
    expect(img).toHaveAttribute("src", "/city_identity/coat_of_arms");
  });

  it("sem brasão: nome com ícone neutro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...ID, coat_of_arms_url: null }) }));
    const { container } = render(<CityHeader />);
    expect(await screen.findByText("Prefeitura de Curitiba")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("rota falhando: Rota Saúde e ícone neutro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));
    const { container } = render(<CityHeader />);
    expect(screen.getByText("Rota Saúde")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Rota Saúde")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("imagem que falha ao carregar cai no ícone neutro, mantendo o nome", async () => {
    vi.stubGlobal("fetch", ok());
    const { container } = render(<CityHeader />);
    fireEvent.error(await screen.findByAltText("Brasão de Curitiba"));
    expect(screen.queryByAltText("Brasão de Curitiba")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Prefeitura de Curitiba")).toBeInTheDocument();
  });

  it("desmontar antes da resposta não atualiza estado", async () => {
    let resolve!: (v: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((r) => { resolve = r; })));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<CityHeader />);
    unmount();
    resolve({ ok: true, status: 200, json: async () => ID });
    await new Promise((r) => setTimeout(r, 0));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
