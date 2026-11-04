// Módulo 30 nos perfis de celular. As rotas /citizen/* são respondidas aqui
// (sem api), com as formas reais: viagens com saída e embarque, TFD e o aviso
// de viagem. Prova a tela real no aparelho: hora da cidade com o aparelho em
// UTC, nada de procedimento, CID, placa, motorista, destino no aviso nem TFD
// rascunho (mesmo que a resposta traga), e sem rolagem lateral.
import { expect, test, type Page, type Route } from "@playwright/test";

test.use({ timezoneId: "UTC" });

const PHONES = new Set([ "iphone", "pixel" ]);
const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null, profile: null };

// Em ordem crescente de saída, como a api devolve (anterior primeiro).
const TRIPS = { items: [
  { id: "t0", date: "2026-10-20", departure_at: "2026-10-20T06:00:00-03:00", boarding: { label: "Praça da Matriz" },
    destination: { name: "Curitiba", provider_name: null }, status: "done", companion: false },
  { id: "t1", date: "2026-11-05", departure_at: "2026-11-05T05:30:00-03:00", boarding: { label: "Praça da Matriz" },
    destination: { name: "Curitiba", provider_name: "Hospital Erasto" },
    status: "confirmed", companion: true,
    procedure: "Radioterapia", cid10: "C50", vehicle: { plate: "ABC1D23" }, driver: { name: "João Motorista" } }
], tfd: [
  { id: "f1", status: "authorized", destination_name: "Londrina", appointment_at: "2026-11-12T08:00:00-03:00",
    allowance_total_cents: 12345, paid: false },
  { id: "f2", status: "draft", destination_name: "Maringá", appointment_at: null, allowance_total_cents: null, paid: false }
] };

const TRIP_NOTICE = { kind: "trip", id: "n1", event: "departure_changed", date: "2026-11-05",
  departure_at: "2026-11-05T05:30:00-03:00", boarding: { label: "Praça da Matriz" }, read: false, cpf_masked: null,
  destination_name: "Curitiba", provider_name: "Hospital Erasto" };

async function mockApi(page: Page, urls: string[]) {
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route: Route) => {
    urls.push(route.request().url());
    const path = new URL(route.request().url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session": return json({ phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "sanitary_transport", "tfd" ] });
      case "/consent_term": return json({ version: "1", body: "Termo de teste" });
      case "/people": return json({ people: [ PERSON ] });
      case "/neighborhoods": return json({ neighborhoods: [] });
      case "/notices": return json({ notices: [ TRIP_NOTICE ], unread_count: 1 });
      case "/notices/n1/read": return json({ ok: true });
      case "/appointments": return json({ appointments: [] });
      case "/triages": return json({ citizen: { ...PERSON, verified_at: "2026-09-01T10:00:00-03:00" }, triages: [] });
      case "/trips": return json(TRIPS);
      default: return json({ error: "not_found" }, 404);
    }
  });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(async ({ page }, info) => {
  test.skip(!PHONES.has(info.project.name), "esta prova roda nos dois celulares (iphone e pixel)");
  // Relógio fixo: o app mostra o ano quando a viagem é de outro ano que o de hoje.
  await page.clock.setFixedTime(new Date("2026-11-03T10:00:00-03:00"));
});

test("Minhas viagens: próximas, anteriores e TFD, sem dado clínico nem escala, sem rolagem lateral", async ({ page }) => {
  const urls: string[] = [];
  await mockApi(page, urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await page.getByRole("button", { name: "Minhas viagens" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Minhas viagens" })).toBeVisible();

  const trip = page.getByRole("listitem", { name: "Viagem para Curitiba — 05/11/2026" });
  await expect(trip.getByText("Saída: qui., 05/11, 05:30", { exact: true })).toBeVisible();
  await expect(trip.getByText("Embarque: Praça da Matriz", { exact: true })).toBeVisible();
  await expect(trip.getByText("Confirmada", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Viagem para Curitiba — 20/10/2026" })).toBeVisible();
  const tfd = page.getByRole("listitem", { name: "TFD para Londrina" });
  await expect(tfd.getByText("Ajuda de custo: R$ 123,45 — a receber", { exact: true })).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Radioterapia|C50|ABC1D23|João Motorista|Rascunho|Maringá/);
  for (const u of urls) {
    const q = new URL(u).search;
    expect(q === "" || /^\?citizen_id=p1$/.test(q)).toBe(true);
  }
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("Aviso de viagem: data, hora e embarque, sem destino", async ({ page }) => {
  const urls: string[] = [];
  await mockApi(page, urls);
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await page.getByRole("navigation", { name: "Conta" }).getByRole("link", { name: /^Avisos/ }).click();
  await page.getByRole("button", { name: /Horário da viagem mudou/ }).click();

  await expect(page.getByText("Saída: qui., 05/11, 05:30", { exact: true })).toBeVisible();
  await expect(page.getByText("Embarque: Praça da Matriz", { exact: true })).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Curitiba|Hospital/);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
