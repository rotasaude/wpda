import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { stubDevice } from "../test/setup";
import { THEME_KEY, applyTheme, effectiveTheme, getChoice, toggleHighContrast, useThemeChoice, watchSystemTheme } from "./theme";

beforeEach(() => { localStorage.clear(); if (getChoice() !== "auto") toggleHighContrast(); localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe("tema do wpda", () => {
  it("auto segue o celular: claro → govbr, escuro → govbr-escuro", () => {
    stubDevice({ dark: false });
    expect(effectiveTheme()).toBe("govbr");
    stubDevice({ dark: true });
    expect(effectiveTheme()).toBe("govbr-escuro");
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe("govbr-escuro");
  });

  it("alto contraste vence o modo escuro e volta ao automático", () => {
    stubDevice({ dark: true });
    toggleHighContrast();
    expect(getChoice()).toBe("alto-contraste");
    expect(document.documentElement.dataset.theme).toBe("alto-contraste");
    expect(localStorage.getItem(THEME_KEY)).toBe("alto-contraste");
    toggleHighContrast();
    expect(getChoice()).toBe("auto");
    expect(document.documentElement.dataset.theme).toBe("govbr-escuro");
  });

  it("troca do modo do celular com a tela aberta reaplica o tema", () => {
    let listener: (() => void) | undefined;
    stubDevice({ dark: false });
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), addEventListener: (_: string, l: () => void) => { listener = l; } })) as typeof window.matchMedia;
    const stop = watchSystemTheme();
    stubDevice({ dark: true });
    listener!();
    expect(document.documentElement.dataset.theme).toBe("govbr-escuro");
    stop();
  });

  it("armazenamento quebrado: alterna em memória sem lançar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    expect(() => toggleHighContrast()).not.toThrow();
    expect(getChoice()).toBe("alto-contraste");
    toggleHighContrast();
    expect(getChoice()).toBe("auto");
  });

  it("useThemeChoice acompanha", () => {
    const { result } = renderHook(() => useThemeChoice());
    expect(result.current).toBe("auto");
    act(() => toggleHighContrast());
    expect(result.current).toBe("alto-contraste");
  });
});
