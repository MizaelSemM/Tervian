import { expect, test } from "@playwright/test";

import { createLead, signUp, uniquePhone } from "./helpers";

/**
 * Fluxo "Hoje" completo (007) e aviso de duplicado (005/US-03).
 */

test("conclui tarefa com resultado e próxima ação em dois toques", async ({ page }) => {
  await signUp(page);
  const leadName = `Carla E2E ${Date.now().toString(36)}`;
  await createLead(page, { name: leadName });

  await page.goto("/hoje");
  const card = page.locator("article").filter({ hasText: leadName });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Concluir", exact: true }).click();
  await card.getByRole("button", { name: "Respondeu", exact: true }).click();
  await card.getByRole("button", { name: "Amanhã", exact: true }).click();

  await expect(page.getByText("Tarefa concluída. Próxima ação agendada.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: leadName })).toHaveCount(0);
});

test("lead duplicado avisa e não cria outro negócio", async ({ page }) => {
  await signUp(page);
  const phone = uniquePhone();
  const leadName = `Bruno E2E ${Date.now().toString(36)}`;
  await createLead(page, { name: leadName, phone });

  await page.goto("/contatos/novo");
  await page.getByLabel("Nome", { exact: true }).fill(`${leadName} repetido`);
  await page.getByLabel("Telefone", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Salvar lead" }).click();

  const duplicateAlert = page
    .getByRole("alert")
    .filter({ hasText: "Este telefone já está cadastrado." });
  await expect(duplicateAlert).toContainText("Este telefone já está cadastrado.");
  await expect(duplicateAlert).toContainText(leadName);
  await expect(page.getByRole("link", { name: "Abrir contato existente" })).toBeVisible();
});
