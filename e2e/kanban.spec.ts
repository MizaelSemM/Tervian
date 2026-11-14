import { expect, test } from "@playwright/test";

import { createLead, signUp } from "./helpers";

/**
 * Kanban e fechamento de negócio (006 / critérios da 014).
 * Viewport de desktop: o arrastar entre colunas é o alvo do teste; no celular
 * a tela usa a lista (o app prioriza a lista no mobile).
 */
test.use({ viewport: { width: 1400, height: 900 } });

test("arrastar negócio entre etapas persiste após recarregar", async ({ page, isMobile }) => {
  test.skip(isMobile, "No celular o funil abre em lista; o arrasto é coberto no desktop.");
  await signUp(page);
  const leadName = `Kanban E2E ${Date.now().toString(36)}`;
  await createLead(page, { name: leadName });

  await page.goto("/negocios?view=kanban");
  const newColumn = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Novo", exact: true }) });
  const contactedColumn = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Contatado", exact: true }) });

  await expect(newColumn.getByText(leadName, { exact: true })).toBeVisible();

  const handle = page.getByRole("button", { name: `Arrastar ${leadName}` });
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  const target = await contactedColumn.boundingBox();
  if (!source || !target) throw new Error("Não foi possível localizar card/coluna do kanban.");

  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  // O dnd-kit exige 8px de movimento para iniciar o arrasto.
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, {
    steps: 5,
  });
  await page.mouse.move(target.x + target.width / 2, target.y + 120, { steps: 15 });
  await page.mouse.up();

  await expect(page.getByText("Negócio movido para “Contatado”.")).toBeVisible({
    timeout: 20_000,
  });

  await page.reload();
  await expect(contactedColumn.getByText(leadName, { exact: true })).toBeVisible();
  await expect(newColumn.getByText(leadName, { exact: true })).toHaveCount(0);
});

test("fechar como perdido exige motivo e, com motivo, fecha o negócio", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "O fluxo de fechamento é coberto no desktop.");
  await signUp(page);
  const leadName = `Perdido E2E ${Date.now().toString(36)}`;
  await createLead(page, { name: leadName });

  await page.goto("/negocios?view=kanban");
  await page.getByRole("link", { name: leadName, exact: true }).click();
  await expect(page.getByRole("heading", { name: leadName, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como perdido" }).click();
  const reason = page.locator("#deal-lost-reason");
  await page.getByRole("button", { name: "Confirmar perda" }).click();

  // Sem motivo o navegador bloqueia o submit (required) — o negócio segue aberto.
  await expect(reason).toHaveValue("");
  await expect(page).not.toHaveURL(/fechado=lost/);

  await reason.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Confirmar perda" }).click();

  await expect(page).toHaveURL(/fechado=lost/, { timeout: 20_000 });
  await expect(page.getByText("Perdido", { exact: true }).first()).toBeVisible();
});
