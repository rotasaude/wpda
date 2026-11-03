// Módulo 29 nos perfis de celular. As rotas /citizen/* são respondidas aqui
// (sem api): o que se prova é a tela real no navegador do aparelho — vacina,
// dose, data, situação do envio e próximas doses, e nada de lote, fabricante,
// vacinador ou dose cancelada (mesmo que a resposta traga), sem rolagem lateral.
import { expect, test, type Page, type Route } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const PHONES = new Set([ "iphone", "pixel" ]);
const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null, profile: null };
const VACCINES = { checked: true,
  items: [
    { immunobiological_name: "Pentavalente", dose_name: "2ª dose", applied_on: "2026-09-15", place_name: "UBS Centro",
      transcription: false, rnds: "sent", lot: "AB123", manufacturer: "Serum Institute", by: "Ana Souza" },
    { immunobiological_name: "BCG", dose_name: "Dose única", applied_on: "2026-01-10", place_name: null,
      transcription: true, rnds: "sending" },
    { immunobiological_name: "Hepatite B", dose_name: "1ª dose", applied_on: "2026-02-01", place_name: "UBS Centro",
      transcription: false, rnds: "sent", status: "cancelled" }
  ],
  upcoming: [ { immunobiological_name: "Pentavalente", dose_name: "3ª dose", due_on: "2026-11-10" } ] };

async function mockApi(page: Page, urls: string[]) {
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route: Route) => {
    urls.push(route.request().url());
    const path = new URL(route.request().url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session": return json({ phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "vaccination" ] });
      case "/consent_term": return json({ version: "1", body: "Termo de teste" });
      case "/people": return json({ people: [ PERSON ] });
      case "/neighborhoods": return json({ neighborhoods: [] });
      case "/notices": return json({ notices: [], unread_count: 0 });
      case "/appointments": return json({ appointments: [] });
      case "/triages": return json({ citizen: { ...PERSON, verified_at: "2026-09-01T10:00:00-03:00" }, triages: [] });
      case "/vaccinations": return json(VACCINES);
      default: return json({ error: "not_found" }, 404);
    }
  });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(({}, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
});

test("Minhas vacinas: doses, envio e próximas, sem lote nem vacinador, sem rolagem lateral", async ({ page }) => {
  const urls: string[] = [];
  await mockApi(page, urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await page.getByRole("button", { name: "Minhas vacinas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Minhas vacinas" })).toBeVisible();

  const penta = page.getByRole("listitem", { name: "Pentavalente — 2ª dose" });
  await expect(penta.getByText("Enviada ao Ministério", { exact: true })).toBeVisible();
  const bcg = page.getByRole("listitem", { name: "BCG — Dose única" });
  await expect(bcg.getByText("Em envio", { exact: true })).toBeVisible();
  await expect(bcg.getByText(/registrada a partir da caderneta/)).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Pentavalente — 3ª dose" }).getByText(/10\/11\/2026/)).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/AB123|Serum|Ana Souza|cancelad|lote/i);
  for (const u of urls) {
    const q = new URL(u).search;
    expect(q === "" || /^\?citizen_id=p1$/.test(q)).toBe(true);
  }
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
