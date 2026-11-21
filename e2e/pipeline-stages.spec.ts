import { expect, test, type Locator } from "@playwright/test";

import { createLead, signUp } from "./helpers";

/**
 * Etapas do funil (RF-24): o admin renomeia, ajusta a probabilidade e reordena
 * em Configurações; a nova ordem persiste e a primeira etapa passa a receber os
 * novos leads.
 */

test.describe.configure({ timeout: 45_000 });

/** No mobile a navegação inferior fixa cobre o rodapé; centralizar evita o clique nela. */
async function clickInViewport(locator: Locator) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await locator.click();
}

test("edita nome, probabilidade e ordem das etapas do funil", async ({ page }) => {
  await signUp(page);
  const suffix = Date.now().toString(36);
  const renamed = `Entrada E2E ${suffix}`;

  await page.goto("/configuracoes");

  await page.getByLabel("Nome da etapa 1").fill(renamed);
  await page.getByLabel("Probabilidade da etapa 1").fill("15");
  await clickInViewport(page.getByRole("button", { name: "Mover etapa 1 para baixo" }));
  await clickInViewport(page.getByRole("button", { name: "Salvar etapas" }));

  await expect(page.getByText("Etapas atualizadas.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome da etapa 1")).toHaveValue("Contatado");
  await expect(page.getByLabel("Nome da etapa 2")).toHaveValue(renamed);
  await expect(page.getByLabel("Probabilidade da etapa 2")).toHaveValue("15");

  const leadName = `Lead etapa E2E ${suffix}`;
  await createLead(page, { name: leadName });
  await expect(
    page.getByText(/Lead criado! O negócio está na primeira etapa do funil/),
  ).toBeVisible();
  await expect(page.getByText(/^Contatado,/).first()).toBeVisible();
});
