// Bloqueio por dispositivo (decisão 9 do ciclo). Por padrão roda contra o wpda
// de dev, que libera o desktop com a faixa de ambiente de teste (wpda#2). Para
// provar o bloqueio de produção, rode contra a imagem nginx sem
// WPDA_ALLOW_DESKTOP e com WPDA_DESKTOP_ALLOWED=0.
import { expect, test } from "@playwright/test";

const PHONES = new Set([ "iphone", "pixel" ]);
const DESKTOP_ALLOWED = (process.env.WPDA_DESKTOP_ALLOWED ?? "1") === "1";

test("o fluxo abre no celular; fora dele, só onde o desktop está liberado", async ({ page }, info) => {
  await page.goto("/wpda/");
  const blocked = page.getByRole("heading", { level: 1, name: "Abra no celular" });
  const banner = page.getByRole("note", { name: "Aviso de ambiente de teste" });
  if (PHONES.has(info.project.name) || DESKTOP_ALLOWED) {
    await expect(page.getByRole("link", { name: "Emergência? Ligar 192" }).first()).toBeVisible();
    await expect(blocked).toHaveCount(0);
  } else {
    await expect(blocked).toBeVisible();
  }
  await expect(banner).toHaveCount(DESKTOP_ALLOWED ? 1 : 0);
});

test("o relatório nunca é bloqueado", async ({ page }) => {
  await page.goto("/wpda/?token=invalido");
  await expect(page.getByRole("heading", { level: 1, name: "Abra no celular" })).toHaveCount(0);
  await expect(page.getByText(/Link inválido|inválido ou expirou|Carregando/).first()).toBeVisible();
});
