import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stubDevice } from "../test/setup";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8");
const inline = /<script data-theme-boot>([\s\S]*?)<\/script>/.exec(html)?.[1];

beforeEach(() => { localStorage.clear(); document.documentElement.dataset.theme = "govbr"; });

describe("script inline do tema do wpda", () => {
  it("<html> abre em govbr e o script vem antes do módulo", () => {
    expect(html).toMatch(/<html lang="pt-BR" data-theme="govbr">/);
    expect(inline).toBeTruthy();
    expect(html.indexOf("data-theme-boot")).toBeLessThan(html.indexOf('type="module"'));
  });

  it("aplica alto contraste salvo", () => {
    localStorage.setItem("rotasaude:wpda-theme", "alto-contraste");
    new Function(inline!)();
    expect(document.documentElement.dataset.theme).toBe("alto-contraste");
  });

  it("segue o modo escuro do celular quando automático", () => {
    stubDevice({ dark: true });
    new Function(inline!)();
    expect(document.documentElement.dataset.theme).toBe("govbr-escuro");
  });

  it("ignora valor inválido", () => {
    localStorage.setItem("rotasaude:wpda-theme", "<x>");
    new Function(inline!)();
    expect(document.documentElement.dataset.theme).toBe("govbr");
  });
});
