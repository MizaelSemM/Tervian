import { expect, test, type Locator } from "@playwright/test";

import { createLead, signUp } from "./helpers";

/**
 * Modelos de mensagem (RF-36): o admin cria em Configurações e o vendedor usa
 * na tela "Hoje", com as variáveis já preenchidas e o link do WhatsApp.
 */

/**
 * No mobile a navegação inferior é fixa e cobre o rodapé da viewport. Ao rolar
 * um alvo para a borda de baixo, o Playwright tenta clicar na nav; centralizar
 * o elemento mantém o clique no botão.
 */
async function clickInViewport(locator: Locator) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await locator.click();
}

test("cria modelo e envia pela tela Hoje com variáveis preenchidas", async ({ page }) => {
  const admin = await signUp(page);
  const suffix = Date.now().toString(36);
  const templateName = `Retorno E2E ${suffix}`;

  await page.goto("/configuracoes");
  await page.getByLabel("Nome do modelo").fill(templateName);
  await page.getByLabel("Mensagem", { exact: true }).fill("Oi, {nome}! Aqui é {vendedor}.");
  await clickInViewport(page.getByRole("button", { name: "Criar modelo" }));

  await expect(page.getByText("Modelo criado.")).toBeVisible();
  await expect(page.getByText(templateName, { exact: true })).toBeVisible();

  const leadName = `Carla Template ${suffix}`;
  await createLead(page, { name: leadName });
  await page.goto("/hoje");

  const card = page.locator("article").filter({ hasText: leadName });
  await expect(card).toBeVisible();
  await clickInViewport(card.getByRole("button", { name: "Mensagem pronta" }));

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Mensagem para Carla" })).toBeVisible();

  await dialog.getByRole("button", { name: new RegExp(templateName) }).click();

  const message = dialog.getByLabel("Mensagem", { exact: true });
  await expect(message).toHaveValue(`Oi, Carla! Aqui é ${admin.name}.`);

  const whatsapp = dialog.getByRole("link", { name: "Abrir no WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
  await expect(whatsapp).toHaveAttribute("href", /text=Oi%2C%20Carla!/);
});

test("edita e exclui um modelo em Configurações", async ({ page }) => {
  await signUp(page);
  const suffix = Date.now().toString(36);
  const templateName = `Editar E2E ${suffix}`;
  const updatedName = `Editado E2E ${suffix}`;

  await page.goto("/configuracoes");
  await page.getByLabel("Nome do modelo").fill(templateName);
  await page.getByLabel("Mensagem", { exact: true }).fill("Oi, {nome}! Mensagem original.");
  await clickInViewport(page.getByRole("button", { name: "Criar modelo" }));
  await expect(page.getByText(templateName, { exact: true })).toBeVisible();

  const row = page.locator("li").filter({ hasText: templateName });
  await clickInViewport(row.getByRole("button", { name: "Editar" }));
  await row.getByLabel("Nome do modelo").fill(updatedName);
  await clickInViewport(row.getByRole("button", { name: "Salvar modelo" }));

  await expect(page.getByText("Modelo atualizado.")).toBeVisible();
  await expect(page.getByText(updatedName, { exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  const updatedRow = page.locator("li").filter({ hasText: updatedName });
  await clickInViewport(updatedRow.getByRole("button", { name: "Excluir" }));

  await expect(page.getByText("Modelo excluído.")).toBeVisible();
  await expect(page.getByText(updatedName, { exact: true })).toHaveCount(0);
});
