import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCityIdentity, resetCityIdentityForTests } from "./cityIdentity";

const ID = { name: "Curitiba", uf: "PR", time_zone: "America/Sao_Paulo", health_department_name: null, coat_of_arms_url: "/city_identity/coat_of_arms" };
beforeEach(() => resetCityIdentityForTests());
afterEach(() => vi.unstubAllGlobals());

describe("loadCityIdentity", () => {
  it("lê /city_identity e memoriza: uma requisição só", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ID });
    vi.stubGlobal("fetch", f);
    const [ a, b ] = await Promise.all([ loadCityIdentity(), loadCityIdentity() ]);
    await loadCityIdentity();
    expect(a).toEqual(ID);
    expect(b).toEqual(ID);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/city_identity");
  });

  it.each([ 404, 429, 500 ])("status %s → null", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }));
    expect(await loadCityIdentity()).toBeNull();
  });

  it("falha de rede → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("net")));
    expect(await loadCityIdentity()).toBeNull();
  });

  it("corpo sem nome → null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    expect(await loadCityIdentity()).toBeNull();
  });
});
