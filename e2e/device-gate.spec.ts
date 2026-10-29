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

// O relatório é público (GET /r/:token, sem login). A API é simulada aqui, como nos outros e2e:
// o que se prova é só que o bloqueio por dispositivo não o alcança, em todos os perfis.
const REPORT = { tier: "moderate", priority: 2, recommendation: null,
  completed_at: "2026-10-27T10:00:00-03:00", expires_at: "2026-11-27T10:00:00-03:00" };

test("o relatório nunca é bloqueado", async ({ page }) => {
  const paths: string[] = [];
  await page.route((url) => url.pathname.startsWith("/r/"), (route) => {
    paths.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(REPORT) });
  });
  await page.goto("/wpda/?token=abc123");
  await expect(page.getByRole("heading", { level: 1, name: "Seu resultado" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Abra no celular" })).toHaveCount(0);
  // O Vite de dev pode repetir o GET (efeito duas vezes): o que importa é que só o relatório foi pedido.
  expect(paths.length).toBeGreaterThan(0);
  expect(new Set(paths)).toEqual(new Set([ "/r/abc123" ]));
});
