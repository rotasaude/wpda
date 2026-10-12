import { describe, expect, it } from "vitest";
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
