// src/lib/route.test.ts
import { describe, expect, it } from "vitest";
import { pathFor, routeFromPath } from "./route";

describe("routeFromPath", () => {
  it.each([
    [ "/wpda/avisos", "/wpda/", "avisos" ],
    [ "/wpda/avisos/", "/wpda/", "avisos" ],
    [ "/wpda/preferencias", "/wpda/", "preferencias" ],
    [ "/avisos", "/", "avisos" ],
    [ "/wpda/avisos", "/wpda", "avisos" ],
    [ "/wpda//avisos", "/wpda/", "avisos" ],
    [ "/wpda//preferencias/", "/wpda/", "preferencias" ]
  ])("%s com base %s → %s", (path, base, route) => expect(routeFromPath(path, base)).toBe(route));

  it.each([
    [ "/wpda/", "/wpda/" ],
    [ "/wpda", "/wpda/" ],
    [ "/wpda/avisosx", "/wpda/" ],
    [ "/wpda/avisos/r1", "/wpda/" ],
    [ "/avisos", "/wpda/" ],
    [ "/wpda/qualquer", "/wpda/" ],
    [ "/", "/" ]
  ])("%s com base %s → sem destino", (path, base) => expect(routeFromPath(path, base)).toBeNull());
});

describe("pathFor", () => {
  it("monta o caminho sob a base", () => {
    expect(pathFor("avisos", "/wpda/")).toBe("/wpda/avisos");
    expect(pathFor("preferencias", "/wpda")).toBe("/wpda/preferencias");
    expect(pathFor(null, "/wpda/")).toBe("/wpda/");
    expect(pathFor(null, "/")).toBe("/");
  });
});
