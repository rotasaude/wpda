// "Meus exames" (módulo 21a) nos perfis de celular. As rotas /citizen/* são
// respondidas aqui (sem api): o que se prova é a tela real no navegador do
// aparelho — as três políticas, o download e a largura sem rolagem lateral.
import { expect, test, type Page, type Route } from "@playwright/test";

const PHONES = new Set([ "iphone", "pixel" ]);
const PERSON = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null, profile: null };

const EXAMS = { verified: true, next_before: null, exams: [
  { id: "ex-imm", label: "Hemograma completo", status_label: "Resultado disponível",
    requested_at: "2026-10-01T09:00:00-03:00", scheduled_at: "2026-10-05T07:30:00-03:00",
    scheduled_place: "Laboratório Simulado — Rua XV, 100",
    result: { available: true, pickup_at_unit: false, released_on: "2026-10-08", pdf_available: true } },
  { id: "ex-ack", label: "Hemoglobina glicada", status_label: "Coletado",
    requested_at: "2026-10-01T09:00:00-03:00", scheduled_at: "2026-10-05T07:30:00-03:00",
    scheduled_place: "Laboratório Simulado — Rua XV, 100", result: null },
  { id: "ex-unit", label: "Sorologia para HIV", status_label: "Resultado pronto",
    requested_at: "2026-10-01T09:00:00-03:00", scheduled_at: null, scheduled_place: null,
    result: { available: false, pickup_at_unit: true, released_on: "2026-10-08", pdf_available: false } }
] };

// Só o caminho /citizen/...: os módulos do Vite (/wpda/src/modules/citizen/…) passam direto.
async function mockApi(page: Page, exams: unknown = EXAMS) {
  await page.route((url) => url.pathname.startsWith("/citizen/"), async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/citizen/, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (path) {
      case "/session": return json({ phone_masked: "(**) *****-5432", time_zone: "America/Sao_Paulo", features: [ "exam_tracking" ] });
      case "/consent_term": return json({ version: "1", body: "Termo de teste" });
      case "/people": return json({ people: [ PERSON ] });
      case "/neighborhoods": return json({ neighborhoods: [] });
      case "/notices": return json({ notices: [], unread_count: 0 });
      case "/appointments": return json({ appointments: [] });
      case "/triages": return json({ citizen: { ...PERSON, verified_at: "2026-09-01T10:00:00-03:00" }, triages: [] });
      case "/exams": return json(exams);
      case "/exams/ex-imm/pdf": return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7\n%%EOF\n" });
      default: return json({ error: "not_found" }, 404);
    }
  });
}

async function openMyExams(page: Page) {
  await page.goto("/wpda/");
  await page.getByRole("button", { name: "Concordo", exact: true }).click();
  await page.getByRole("button", { name: `Ver triagens de ${PERSON.cpf_masked}` }).click();
  await page.getByRole("button", { name: "Meus exames" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Meus exames" })).toBeVisible();
}

test.beforeEach(({}, info) => {
  test.skip(!PHONES.has(info.project.name), "o fluxo do cidadão só abre no celular (device-gate.spec.ts)");
});

test("as três políticas do laudo, sem rolagem lateral", async ({ page }) => {
  await mockApi(page);
  await openMyExams(page);

  const imm = page.getByRole("listitem", { name: "Hemograma completo" });
  await expect(imm.getByText("Resultado disponível — liberado em 08/10/2026", { exact: true })).toBeVisible();
  await expect(imm.getByRole("button", { name: "Baixar resultado de Hemograma completo" })).toBeVisible();

  const ack = page.getByRole("listitem", { name: "Hemoglobina glicada" });
  await expect(ack.getByText("Coletado", { exact: true })).toBeVisible();
  await expect(ack.getByRole("button")).toHaveCount(0);

  const unit = page.getByRole("listitem", { name: "Sorologia para HIV" });
  await expect(unit.getByText("Retire o resultado na sua unidade de saúde.", { exact: true })).toBeVisible();
  await expect(unit.getByRole("button")).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("par declarado: o convite e nenhum exame", async ({ page }) => {
  await mockApi(page, { verified: false, exams: EXAMS.exams, next_before: null });
  await openMyExams(page);
  await expect(page.getByRole("note", { name: "cadastro não validado" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Validar no posto" })).toBeVisible();
});

test("baixar o resultado: arquivo sem dado pessoal", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel", "download por endereço blob: conferido no Chromium");
  await mockApi(page);
  await openMyExams(page);
  const [ download ] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar resultado de Hemograma completo" }).click()
  ]);
  expect(download.suggestedFilename()).toBe("exame-ex-imm.pdf");
});
