// Módulo 35b nos perfis de celular (contrato §4, §14, Q15). As rotas /citizen/* são respondidas aqui, sem api.
// Prova nos dois caminhos (Solicitação identificada e denúncia anônima) que subtipo e endereço do local vão só no corpo,
// que a anônima não leva cookie, que nada rola para o lado e que, com o interruptor desligado, a pergunta não existe.
// As frases ficam copiadas aqui (Global Constraints do plano): o e2e não importa src/.
import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const PHONES = new Set([ "iphone", "pixel" ]);
const ZOONOSES_QUESTION = "É sobre animais, insetos ou bichos?";
const ZOONOSES_ADDRESS_LABEL = "Onde fica o problema? (endereço do local)";
const ZOONOSES_NOTICE = "Seu pedido vai direto ao centro de zoonoses. Não escreva seu nome nem telefone no texto.";
const SCORPION_TEXT = "Tem escorpião saindo do bueiro da calçada todas as noites.";
const SCORPION_ADDRESS = "Rua das Flores, 120, fundos";
const BAT_TEXT = "Há morcegos dormindo no forro do coreto e as crianças brincam embaixo.";
const BAT_ADDRESS = "Praça Central, perto do coreto";

async function mockApi(page: Page, opts: { signedIn: boolean; zoonoses: boolean }) {
  const manifestations: Request[] = [];
  const reports: Request[] = [];
  const sessions: Request[] = []; // GET /citizen/session vai com o cookie (same-origin): o controle positivo da prova
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session":
        sessions.push(req);
        return opts.signedIn
          ? json({ phone_masked: "(41) *****-4321", time_zone: "America/Sao_Paulo", features: [ "ombudsman", "ombudsman_anonymous_web" ] })
          : json({ error: "unauthenticated" }, 401);
      case "/people":
        return json({ people: [ { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null, profile: null } ] });
      case "/notices": return json({ notices: [], unread_count: 0 });
      case "/ombudsman/manifestations":
        if (req.method() === "POST") { manifestations.push(req); return json({ id: "m1", protocol: "2026-000321", due_on: "2026-12-23" }, 201); }
        return json({ manifestations: [] });
      case "/ombudsman/public_config":
        return json({ anonymous_web: true, zoonoses: opts.zoonoses, units: [ { id: "u1", name: "UBS Centro" } ] });
      case "/ombudsman/anonymous_reports":
        reports.push(req);
        return json({ ok: true }, 201);
      default: return json({ error: "not_found" }, 404);
    }
  });
  return { manifestations, reports, sessions };
}

const cookieOf = async (req: Request) => (await req.allHeaders())["cookie"];

// Mesmo tratamento do 33 (e2e/ombudsman.spec.ts): o WebKit (iphone) não entrega o Cookie de pedido interceptado, então lá
// o teste afirma que o controle está cego; no Chromium (pixel) o controle positivo vê o cookie e o envio não o leva.
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
const next = (page: Page) => page.getByRole("button", { name: "Continuar" }).click();
const pick = (page: Page, label: RegExp | string) => page.getByRole("radio", { name: label }).check();

test.beforeEach(async ({ page }, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
  await page.clock.setFixedTime(new Date("2026-11-23T10:00:00-03:00"));
});

test("Solicitação de escorpião: pergunta, assunto, endereço e aviso; corpo exato", async ({ page }) => {
  const { manifestations } = await mockApi(page, { signedIn: true, zoonoses: true });
  await page.goto("/wpda/ouvidoria");
  await page.getByRole("button", { name: "Nova manifestação" }).click();

  await pick(page, /^Solicitação/);
  await next(page);
  await expect(page.getByRole("heading", { level: 1, name: ZOONOSES_QUESTION })).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await pick(page, "Sim");
  await next(page);
  await expect(page.getByRole("heading", { level: 1, name: "O que está acontecendo?" })).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await pick(page, "Escorpião");
  await next(page);
  await pick(page, /^Identificada/);
  await next(page);

  await expect(page.getByRole("heading", { level: 1, name: "Sua manifestação" })).toBeVisible();
  await expect(page.getByText(ZOONOSES_NOTICE, { exact: true })).toBeVisible();
  await page.getByLabel(ZOONOSES_ADDRESS_LABEL).fill(SCORPION_ADDRESS);
  await page.getByRole("textbox", { name: "Conte o que aconteceu" }).fill(SCORPION_TEXT);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Enviar manifestação" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Manifestação registrada" })).toBeVisible();
  expect(manifestations).toHaveLength(1);
  const req = manifestations[0];
  expect(new URL(req.url()).pathname).toBe("/citizen/ombudsman/manifestations");
  expect(new URL(req.url()).search).toBe("");
  expect(req.postDataJSON()).toEqual({
    citizen_id: "p1", kind: "request", identification_mode: "identified", body: SCORPION_TEXT,
    zoonoses_subtype: "scorpion", place_address: SCORPION_ADDRESS
  });
});

test("Denúncia anônima de morcego: assunto e endereço, corpo exato, sem cookie", async ({ page, context, baseURL }) => {
  await context.addCookies([ { name: "citizen_session", value: "plantado", url: baseURL as string } ]);
  const { reports, sessions } = await mockApi(page, { signedIn: false, zoonoses: true });
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Denúncia anônima", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeVisible();

  await pick(page, "Sim");
  await pick(page, "Morcego");
  await page.getByLabel(ZOONOSES_ADDRESS_LABEL).fill(BAT_ADDRESS);
  await page.getByRole("textbox", { name: "O que você quer denunciar?" }).fill(BAT_TEXT);
  const send = page.getByRole("button", { name: "Enviar denúncia" });
  await send.scrollIntoViewIfNeeded();
  const notice = page.getByText(ZOONOSES_NOTICE, { exact: true });
  await expect(notice).toBeVisible();
  expect((await notice.boundingBox())!.y).toBeLessThan((await send.boundingBox())!.y);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await send.click();

  await expect(page.getByRole("heading", { level: 1, name: "Denúncia enviada" })).toBeVisible();
  expect(reports).toHaveLength(1);
  const req = reports[0];
  expect(new URL(req.url()).pathname).toBe("/citizen/ombudsman/anonymous_reports");
  expect(new URL(req.url()).search).toBe("");
  expect(req.postDataJSON()).toEqual({ body: BAT_TEXT, zoonoses_subtype: "bat", place_address: BAT_ADDRESS });
  expect(sessions.length).toBeGreaterThan(0);
  await expectNoCookie(req, sessions[0]);
  expect(await page.locator("body").innerText()).not.toMatch(/[Pp]rotocolo \d/);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("Zoonoses desligado: nenhuma pergunta nos dois caminhos", async ({ page }) => {
  const { reports } = await mockApi(page, { signedIn: false, zoonoses: false });
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Denúncia anônima", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncia anônima" })).toBeVisible();
  // Controle positivo: a configuração já chegou (a unidade só aparece com ela), então a ausência da pergunta é do interruptor.
  await expect(page.getByRole("combobox", { name: "Unidade de saúde (opcional)" }).locator("option", { hasText: "UBS Centro" })).toHaveCount(1);
  await expect(page.getByText(ZOONOSES_QUESTION)).toHaveCount(0);
  await page.getByRole("textbox", { name: "O que você quer denunciar?" }).fill(BAT_TEXT);
  await page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncia enviada" })).toBeVisible();
  expect(reports).toHaveLength(1);
  expect(reports[0].postDataJSON()).toEqual({ body: BAT_TEXT });

  await page.unrouteAll({ behavior: "ignoreErrors" });
  const { manifestations } = await mockApi(page, { signedIn: true, zoonoses: false });
  const config = page.waitForResponse(r => new URL(r.url()).pathname === "/citizen/ombudsman/public_config");
  await page.goto("/wpda/ouvidoria");
  await page.getByRole("button", { name: "Nova manifestação" }).click();
  expect((await config).status()).toBe(200); // controle positivo: a configuração (zoonoses: false) chegou antes da pergunta que não vem
  await pick(page, /^Solicitação/);
  await next(page);
  await expect(page.getByText(ZOONOSES_QUESTION)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Como você quer se identificar?" })).toBeVisible();
  await pick(page, /^Identificada/);
  await next(page);
  await page.getByRole("textbox", { name: "Conte o que aconteceu" }).fill(SCORPION_TEXT);
  await page.getByRole("button", { name: "Enviar manifestação" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Manifestação registrada" })).toBeVisible();
  expect(manifestations).toHaveLength(1);
  expect(manifestations[0].postDataJSON()).toEqual({ citizen_id: "p1", kind: "request", identification_mode: "identified", body: SCORPION_TEXT });
});
