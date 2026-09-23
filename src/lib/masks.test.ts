import { describe, it, expect } from "vitest";
import { maskPhone, isMobilePhone, maskCpf, isValidCpf } from "./masks";

describe("maskPhone", () => {
  it("formata enquanto digita", () => {
    expect(maskPhone("4")).toBe("(4");
    expect(maskPhone("41998")).toBe("(41) 998");
    expect(maskPhone("41998765432")).toBe("(41) 99876-5432");
    expect(maskPhone("4199876543299")).toBe("(41) 99876-5432");
  });
});

describe("isMobilePhone", () => {
  it("aceita celular e recusa fixo", () => {
    expect(isMobilePhone("(41) 99876-5432")).toBe(true);
    expect(isMobilePhone("(41) 3333-4444")).toBe(false);
  });
});

describe("maskCpf", () => {
  it("formata enquanto digita", () => {
    expect(maskCpf("529")).toBe("529");
    expect(maskCpf("5299822")).toBe("529.982.2");
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
  });
});

describe("isValidCpf", () => {
  it("confere o dígito verificador", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});
