import { expect, test } from "@playwright/test";

const PHONES = new Set([ "iphone", "pixel" ]);

test("o fluxo abre só no celular", async ({ page }, info) => {
  await page.goto("/wpda/");
  const blocked = page.getByRole("heading", { level: 1, name: "Abra no celular" });
  if (PHONES.has(info.project.name)) {
    await expect(page.getByRole("link", { name: "Emergência? Ligar 192" }).first()).toBeVisible();
    await expect(blocked).toHaveCount(0);
  } else {
    await expect(blocked).toBeVisible();
  }
});

test("o relatório nunca é bloqueado", async ({ page }) => {
  await page.goto("/wpda/?token=invalido");
  await expect(page.getByRole("heading", { level: 1, name: "Abra no celular" })).toHaveCount(0);
  await expect(page.getByText(/Link inválido|inválido ou expirou|Carregando/).first()).toBeVisible();
});
