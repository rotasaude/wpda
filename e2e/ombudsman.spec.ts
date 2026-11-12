// Módulo 33 nos perfis de celular (contrato §4, §14). As rotas /citizen/* são respondidas aqui, sem api.
// Prova a denúncia anônima no aparelho: sem login, o aviso antes do envio, o corpo exato, nenhum cookie
// (mesmo com um citizen_session plantado, que o GET /citizen/session leva: o controle positivo), nenhum protocolo na tela e sem rolagem lateral.
import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const PHONES = new Set([ "iphone", "pixel" ]);
const TEXT = "Na UBS Centro cobraram R$ 50 pela consulta, o que é proibido no SUS.";
const WARNING = "Sem identificação, você não recebe protocolo nem acompanha a resposta.";

async function mockApi(page: Page, opts: { anonymous: boolean; configStatus?: number }) {
  const reports: Request[] = [];
  const sessions: Request[] = []; // GET /citizen/session vai com o cookie (same-origin): o controle positivo da prova
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session":
        sessions.push(route.request());
        return json({ error: "unauthenticated" }, 401);
      case "/ombudsman/public_config":
        return opts.configStatus === 403 ? json({ error: "feature_disabled", feature: "ombudsman" }, 403)
          : json({ anonymous_web: opts.anonymous, units: [ { id: "u1", name: "UBS Centro" }, { id: "u2", name: "Centro Municipal de Especialidades Odontológicas Vila Hauer e Boqueirão" } ] });
      case "/ombudsman/anonymous_reports":
        reports.push(route.request());
        // O api real manda só { ok: true }; o protocolo falso é defesa: a tela deve ignorá-lo.
        return json({ ok: true, protocol: "2026-000999" }, 201);
      default: return json({ error: "not_found" }, 404);
    }
  });
  return { reports, sessions };
}

const cookieOf = async (req: Request) => (await req.allHeaders())["cookie"];

// "Nenhum cookie" só prova algo se o mesmo meio vê o cookie onde ele vai: o GET /citizen/session (same-origin) é o controle positivo.
// O Chromium (pixel) entrega o Cookie de um pedido interceptado; o WebKit (iphone) não o entrega por nenhum meio do Playwright
// (allHeaders, headerValue, headersArray, route.request().headers(), conferido em 2026-11-12). Lá a afirmação seria vazia: o teste
// afirma que o controle está cego, e falha se o WebKit passar a entregar o Cookie, para a prova ser ligada também nele.
async function expectNoCookie(report: Request, session: Request) {
  if (test.info().project.name === "iphone") {
    expect(await cookieOf(session)).toBeUndefined();
    test.info().annotations.push({ type: "cookie", description: "WebKit não expõe o Cookie de pedido interceptado: prova no pixel e no teste de unidade (credentials: omit)" });
    return;
  }
  expect(await cookieOf(session)).toContain("citizen_session=plantado");
  expect(await cookieOf(report)).toBeUndefined();
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(async ({ page }, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
  await page.clock.setFixedTime(new Date("2026-11-12T10:00:00-03:00"));
});

test("Denúncia anônima: sem login, aviso antes do envio, sem cookie, sem protocolo, sem rolagem lateral", async ({ page, context, baseURL }) => {
  await context.addCookies([ { name: "citizen_session", value: "plantado", url: baseURL as string } ]);
  const { reports, sessions } = await mockApi(page, { anonymous: true });
  await page.goto("/wpda/");
  await expect(page.getByRole("heading", { level: 2, name: "Ouvidoria" })).toBeVisible();
  await page.getByRole("button", { name: "Denúncia anônima", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Conta" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Unidade de saúde (opcional)" }).selectOption("u1");
  await page.getByRole("textbox", { name: "O que você quer denunciar?" }).fill(TEXT);
  const send = page.getByRole("button", { name: "Enviar denúncia" });
  await send.scrollIntoViewIfNeeded();
  const warning = page.getByText(WARNING, { exact: true }).last();
  await expect(warning).toBeInViewport();
  const [ wy, by ] = [ (await warning.boundingBox())!.y, (await send.boundingBox())!.y ];
  expect(wy).toBeLessThan(by);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await send.click();

  await expect(page.getByRole("heading", { level: 1, name: "Denúncia enviada" })).toBeVisible();
  expect(reports).toHaveLength(1);
  const req = reports[0];
  expect(req.method()).toBe("POST");
  expect(new URL(req.url()).pathname).toBe("/citizen/ombudsman/anonymous_reports");
  expect(new URL(req.url()).search).toBe("");
  expect(req.postDataJSON()).toEqual({ body: TEXT, health_unit_id: "u1" });
  expect(sessions.length).toBeGreaterThan(0);
  await expectNoCookie(req, sessions[0]);
  expect(await page.locator("body").innerText()).not.toMatch(/2026-000999|[Pp]rotocolo \d/);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("Sem unidade: o corpo é exatamente { body } e nenhum cookie sai", async ({ page, context, baseURL }) => {
  await context.addCookies([ { name: "citizen_session", value: "plantado", url: baseURL as string } ]);
  const { reports, sessions } = await mockApi(page, { anonymous: true });
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Denúncia anônima", exact: true }).click();
  await page.getByRole("textbox", { name: "O que você quer denunciar?" }).fill(TEXT);
  await page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncia enviada" })).toBeVisible();
  expect(reports).toHaveLength(1);
  expect(reports[0].postDataJSON()).toEqual({ body: TEXT });
  expect(sessions.length).toBeGreaterThan(0);
  await expectNoCookie(reports[0], sessions[0]);
});

test("Texto curto: erro no campo e nada enviado", async ({ page }) => {
  const { reports } = await mockApi(page, { anonymous: true });
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Denúncia anônima", exact: true }).click();
  await page.getByRole("textbox", { name: "O que você quer denunciar?" }).fill("curto");
  await page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByText("Escreva pelo menos 20 caracteres.")).toBeVisible();
  expect(reports).toHaveLength(0);
});

test("Sem anonymous_web: só a manifestação; public_config 403: nada da Ouvidoria", async ({ page }) => {
  await mockApi(page, { anonymous: false });
  await page.goto("/wpda/");
  await expect(page.getByRole("button", { name: "Fazer uma manifestação" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Denúncia anônima", exact: true })).toHaveCount(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockApi(page, { anonymous: true, configStatus: 403 });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Triagem de saúde" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ouvidoria" })).toHaveCount(0);
});
