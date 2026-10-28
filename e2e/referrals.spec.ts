// Módulo 26a nos perfis de celular. As rotas /citizen/* são respondidas aqui
// (sem api): o que se prova é a tela real no navegador do aparelho — a
// situação, a data e o local, e nada de cor, posição, CID ou justificativa
// (mesmo que a resposta traga), sem rolagem lateral.
import { expect, test, type Page, type Route } from "@playwright/test";

// O navegador roda em UTC de propósito: o "14:30" só aparece se o app formatar no fuso da cidade
// (America/Sao_Paulo, vindo da sessão) e não no fuso do aparelho.
test.use({ timezoneId: "UTC" });

const PHONES = new Set([ "iphone", "pixel" ]);
const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null, profile: null };
// A resposta traz campos que o contrato proíbe mostrar: o cliente descarta, a tela não desenha.
const REQUESTS = { requests: [
  { id: "rr1", label: "Consulta em Cardiologia", status: "scheduled", scheduled_at: "2026-11-10T14:30:00-03:00",
    place: "Ambulatório de Especialidades — Rua XV, 100", updated_at: "2026-10-27T10:00:00-03:00",
    color: "red", position: 2, cid10: "I209", justification: "Dor aos esforços há três meses" },
  { id: "rr2", label: "Ecocardiografia transtorácica", status: "waiting", scheduled_at: null, place: null,
    updated_at: "2026-10-20T10:00:00-03:00", color: "yellow", position: 37 },
  { id: "rr3", label: "Consulta em Ortopedia", status: "returned", scheduled_at: null, place: null, updated_at: "2026-10-22T10:00:00-03:00" }
] };
const APPOINTMENTS = { appointments: [ { request: { id: "ar1", kind: "regulated", target_unit_name: "Ambulatório de Especialidades",
  status: "open", closed_reason: null, reopened_reason: null }, appointment: null } ] };

async function mockApi(page: Page, urls: string[]) {
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route: Route) => {
    urls.push(route.request().url());
    const path = new URL(route.request().url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session": return json({ phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "care_regulation" ] });
      case "/consent_term": return json({ version: "1", body: "Termo de teste" });
      case "/people": return json({ people: [ PERSON ] });
      case "/neighborhoods": return json({ neighborhoods: [] });
      case "/notices": return json({ notices: [], unread_count: 0 });
      case "/appointments": return json(APPOINTMENTS);
      case "/triages": return json({ citizen: { ...PERSON, verified_at: "2026-09-01T10:00:00-03:00" }, triages: [] });
      case "/regulation_requests": return json(REQUESTS);
      default: return json({ error: "not_found" }, 404);
    }
  });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(({}, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
});

test("Meus encaminhamentos: situação, data e local, sem fila nem cor, sem rolagem lateral", async ({ page }) => {
  const urls: string[] = [];
  await mockApi(page, urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await expect(page.getByText("Encaminhamento autorizado para Ambulatório de Especialidades — a unidade vai marcar o horário")).toBeVisible();
  await page.getByRole("button", { name: "Meus encaminhamentos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Meus encaminhamentos" })).toBeVisible();

  const cardio = page.getByRole("listitem", { name: "Consulta em Cardiologia" });
  await expect(cardio.getByText("Agendado", { exact: true })).toBeVisible();
  // 10/11 às 14:30 no fuso da cidade (fmtWeekdayDateTime), com o navegador em UTC (test.use acima).
  await expect(cardio.getByText(/10\/11.*14:30/)).toBeVisible();
  await expect(cardio.getByText(/Ambulatório de Especialidades — Rua XV, 100/)).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Ecocardiografia transtorácica" }).getByText("Aguardando a regulação")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Consulta em Ortopedia" }).getByText("Em revisão pela sua unidade")).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/vermelh|amarel|posição|fila|I209|esforços|prazo|urgente|\b37\b/i);
  const regulation = urls.filter((u) => new URL(u).pathname === "/citizen/regulation_requests");
  expect(regulation.length).toBeGreaterThan(0);
  for (const u of regulation) expect(new URL(u).search).toBe("?citizen_id=p1");
  for (const u of urls) {
    const q = new URL(u).search;
    expect(q === "" || /^\?citizen_id=p1$/.test(q)).toBe(true);
  }
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
