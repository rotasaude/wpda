// Módulo 23 nos perfis de celular. As rotas /citizen/* são respondidas aqui
// (sem api): o que se prova é a tela real no navegador do aparelho — o perfil
// com as condições declaradas (o nome da condição só no corpo), "Meu
// acompanhamento" e a triagem periódica vencida, sem rolagem lateral.
// O fluxo roda nos perfis de celular; no dev server (MODE development) ele
// também abre no desktop, mas esta prova fica nos dois celulares.
import { expect, test, type Page, type Route } from "@playwright/test";

const PHONES = new Set([ "iphone", "pixel" ]);
const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null,
  profile: { birth_date: "1963-04-02", sex: "female", gender_identity: null, profile_source: "verified" } };
const CATALOG = { in_progress: null, suggested: [], recent: [], reference_units: [],
  available: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Avaliação anual de quedas, memória e medicamentos.",
    overdue: true, last_done_at: "2025-10-02" } ] };
// O api nunca manda item "untracked" (P5a): a fixture só traz situações rastreadas.
const CARE = { overdue_triages: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", last_done_at: "2025-10-02" } ],
  lines: [ { name: "Pessoa com diabetes", items: [
  { label: "medir a pressão", status: "due_soon", due_on: "2026-11-12" },
  { label: "exame de hemoglobina glicada", status: "overdue", due_on: "2026-08-20" },
  { label: "exame dos pés", status: "ok", due_on: null }
] } ] };

type Sent = { method: string; url: string; body: unknown };

// Dado de saúde nunca vai na URL: o nome da condição (código ou português) só no corpo.
const HEALTH_IN_URL = /diabetes|hypertension|pregnancy|mental_health|press[aã]o(%20|\+| )alta|gr[aá]vida|sa[uú]de(%20|\+| )mental/i;

// Só o caminho /citizen/...: os módulos do Vite (/wpda/src/modules/citizen/…) passam direto.
// `urls` recebe TODA requisição /citizen/* (não só a das condições).
async function mockApi(page: Page, sent: Sent[], urls: string[]) {
  let active = [ { condition: "diabetes", declared_at: "2026-10-20T10:00:00-03:00" } ];
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route: Route) => {
    const req = route.request();
    urls.push(req.url());
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session": return json({ phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "care_lines" ] });
      case "/consent_term": return json({ version: "1", body: "Termo de teste" });
      case "/people": return json({ people: [ PERSON ] });
      case "/neighborhoods": return json({ neighborhoods: [] });
      case "/notices": return json({ notices: [], unread_count: 0 });
      case "/appointments": return json({ appointments: [] });
      case "/triages": return json({ citizen: { ...PERSON, verified_at: "2026-09-01T10:00:00-03:00" }, triages: [] });
      case "/people/p1/catalog": return json(CATALOG);
      case "/care": return json(CARE);
      case "/declared_conditions": {
        const body = req.postData() ? JSON.parse(req.postData() as string) : null;
        sent.push({ method: req.method(), url: req.url(), body });
        if (req.method() === "POST") active = [ ...active, { condition: body.condition, declared_at: "2026-10-22T10:00:00-03:00" } ];
        if (req.method() === "DELETE") active = active.filter((c) => c.condition !== body.condition);
        return json({ conditions: active }, req.method() === "POST" ? 201 : 200);
      }
      default: return json({ error: "not_found" }, 404);
    }
  });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(({}, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
});

test("triagem vencida e condições de saúde no perfil, sem rolagem lateral", async ({ page }) => {
  const sent: Sent[] = [];
  const urls: string[] = [];
  await mockApi(page, sent, urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `CPF ${PERSON.cpf_masked}` }).click();

  const overdue = page.getByRole("region", { name: "Está na hora de refazer" });
  await expect(overdue.getByText("Saúde do idoso", { exact: true })).toBeVisible();
  await expect(overdue.getByText("Feita pela última vez em 02/10/2025", { exact: true })).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Meu perfil" }).click();
  const conditions = page.getByRole("region", { name: "Condições de saúde" });
  await expect(page.getByRole("heading", { name: "Condições de saúde" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Tenho diabetes" })).toBeChecked();
  await page.getByRole("switch", { name: "Tenho pressão alta" }).click();
  await expect(conditions.getByRole("status")).toHaveText("Informação salva.");
  await page.getByRole("switch", { name: "Tenho diabetes" }).click();
  await expect(conditions.getByRole("status")).toHaveText("Informação retirada.");
  await expect(page.getByRole("switch", { name: "Tenho diabetes" })).not.toBeChecked();

  const writes = sent.filter((s) => s.method !== "GET");
  expect(writes.map((s) => [ s.method, s.body ])).toEqual([
    [ "POST", { citizen_id: "p1", condition: "hypertension" } ], [ "DELETE", { condition: "diabetes" } ]
  ]);
  expect(urls.length).toBeGreaterThan(sent.length);
  for (const u of urls) expect(u).not.toMatch(HEALTH_IN_URL);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("Meu acompanhamento em linguagem simples, sem rolagem lateral", async ({ page }) => {
  const urls: string[] = [];
  await mockApi(page, [], urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await page.getByRole("button", { name: "Meu acompanhamento" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Meu acompanhamento" })).toBeVisible();

  const line = page.getByRole("region", { name: "Pessoa com diabetes" });
  await expect(line.getByRole("listitem", { name: "Medir a pressão" }).getByText("Faça até 12/11/2026")).toBeVisible();
  await expect(line.getByRole("listitem", { name: "Exame de hemoglobina glicada" })
    .getByText("Está na hora — procure a sua unidade de saúde")).toBeVisible();
  await expect(line.getByRole("listitem", { name: "Exame dos pés" }).getByText("Em dia", { exact: true })).toBeVisible();
  const screenings = page.getByRole("region", { name: "Triagens para refazer" });
  await expect(screenings.getByRole("listitem", { name: "Saúde do idoso" })).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);

  // "Começar" leva ao catálogo da pessoa.
  await screenings.getByRole("button", { name: "Começar: Saúde do idoso" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Qual triagem fazer?" })).toBeVisible();
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u).not.toMatch(HEALTH_IN_URL);
});
