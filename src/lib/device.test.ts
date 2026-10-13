import { afterEach, describe, expect, it } from "vitest";
import { stubDevice } from "../test/setup";
import { isPhone } from "./device";

describe("isPhone", () => {
  it.each([
    [ "celular em pé", { width: 390, height: 844, coarse: true }, true ],
    [ "celular deitado", { width: 844, height: 390, coarse: true }, true ],
    [ "tablet", { width: 768, height: 1024, coarse: true }, false ],
    [ "notebook com toque", { width: 1366, height: 768, coarse: true }, false ],
    [ "desktop", { width: 1920, height: 1080, coarse: false }, false ],
    [ "celular com mouse", { width: 390, height: 844, coarse: false }, false ]
  ])("%s", (_name, dev, expected) => {
    stubDevice(dev);
    expect(isPhone()).toBe(expected);
  });
});

// Dobrável aberto (A-16): lado menor ≥ 600, mas se declara celular.
describe("isPhone — dobráveis (A-16)", () => {
  const realUa = window.navigator.userAgent;
  function declare(ua: string, uaData?: { mobile: boolean }) {
    Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: ua });
    Object.defineProperty(window.navigator, "userAgentData", { configurable: true, value: uaData });
  }
  afterEach(() => declare(realUa, undefined));

  it("aberto, com userAgentData.mobile, passa", () => {
    stubDevice({ width: 673, height: 841, coarse: true });
    declare("Mozilla/5.0 (Linux; Android 14)", { mobile: true });
    expect(isPhone()).toBe(true);
  });

  it("aberto, com 'Android … Mobile' no UA, passa", () => {
    stubDevice({ width: 673, height: 841, coarse: true });
    declare("Mozilla/5.0 (Linux; Android 14; SM-F946B) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36");
    expect(isPhone()).toBe(true);
  });

  it("iPad continua bloqueado", () => {
    stubDevice({ width: 834, height: 1194, coarse: true });
    declare("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1");
    expect(isPhone()).toBe(false);
  });

  it("tablet Android (sem 'Mobile') continua bloqueado", () => {
    stubDevice({ width: 800, height: 1280, coarse: true });
    declare("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/126.0 Safari/537.36", { mobile: false });
    expect(isPhone()).toBe(false);
  });

  it("sem toque, mesmo se declarando celular, fica bloqueado", () => {
    stubDevice({ width: 1920, height: 1080, coarse: false });
    declare("Mozilla/5.0 (Linux; Android 14) Mobile", { mobile: true });
    expect(isPhone()).toBe(false);
  });
});
