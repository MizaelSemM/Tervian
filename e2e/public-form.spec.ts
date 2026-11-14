import { expect, test } from "@playwright/test";

import { publicFormSlug, signUp, uniquePhone } from "./helpers";

/**
 * Formulário público (010): o lead cai na tela "Hoje" do responsável.
 */
test("formulário público cria lead e ele aparece em Hoje", async ({ page }) => {
  await signUp(page, { companyName: "Empresa Formulario E2E" });
  const slug = await publicFormSlug(page);

  const leadName = `Formulario E2E ${Date.now().toString(36)}`;
  const phone = uniquePhone();

  await page.goto(`/f/${slug}`);
  await page.getByLabel("Nome", { exact: true }).fill(leadName);
  await page.getByLabel("Telefone", { exact: true }).fill(phone);

  // O servidor ignora envios feitos em menos de 1,5s (proteção anti-bot).
  await page.waitForTimeout(1_700);

  await page.getByRole("button", { name: "Quero falar" }).click();
  await expect(page.getByRole("heading", { name: "Recebemos seu contato" })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/hoje");
  await expect(page.getByRole("link", { name: leadName, exact: true })).toBeVisible();
});
