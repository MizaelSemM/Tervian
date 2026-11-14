import { expect, test } from "@playwright/test";

import { login, logout, signUp, TEST_PASSWORD, uniqueEmail, uniqueSuffix } from "./helpers";

/**
 * Autenticação, convite e papéis (tarefa 003 / critério da 014).
 * Cada teste usa uma conta própria; o convite é consumido uma única vez.
 */

test("cadastro exige aceite dos termos e entra direto na tela Hoje", async ({ page }) => {
  await page.goto("/cadastro");

  const suffix = uniqueSuffix();
  await page.getByLabel("Nome da empresa", { exact: true }).fill(`Empresa Termos ${suffix}`);
  await page.getByLabel("Seu nome", { exact: true }).fill("Admin Termos");
  await page.getByLabel("E-mail", { exact: true }).fill(uniqueEmail("termos"));
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();

  // Sem marcar o checkbox, o servidor recusa e não cria a conta.
  await expect(page.getByRole("alert").filter({ hasText: /termos/i })).toBeVisible();
  await expect(page).toHaveURL(/\/cadastro/);

  // Os demais campos são preservados; a senha nunca volta para o formulário.
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/hoje$/);
});

test("convite cria vendedor, login funciona e vendedor não acessa o painel", async ({
  page,
  browser,
}, testInfo) => {
  await signUp(page, { companyName: "Empresa Convite E2E" });

  const sellerEmail = uniqueEmail("vendedor");
  await page.goto("/equipe");
  await page.getByLabel("E-mail", { exact: true }).fill(sellerEmail);
  await page.getByLabel("Papel", { exact: true }).selectOption("SELLER");
  await page.getByRole("button", { name: "Criar convite" }).click();

  const inviteCode = page.locator("code").filter({ hasText: "/convite/" });
  await expect(inviteCode).toBeVisible();
  const inviteUrl = new URL((await inviteCode.textContent()) ?? "");
  expect(inviteUrl.pathname).toMatch(/^\/convite\/.+/);

  // O convidado abre o link em um contexto limpo (sem a sessão do admin).
  const sellerContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto(inviteUrl.pathname);
  await sellerPage.getByLabel("Seu nome", { exact: true }).fill("Vendedor E2E");
  await sellerPage.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await sellerPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(sellerPage.getByRole("heading", { name: /^Olá,/ })).toBeVisible({
    timeout: 30_000,
  });

  // Sair e entrar de novo prova que a senha do aceite vale no login.
  await logout(sellerPage);
  await login(sellerPage, sellerEmail);

  // Vendedor não pode abrir o painel do gestor (requireRole redireciona).
  await sellerPage.goto("/painel");
  await expect(sellerPage).toHaveURL(/\/hoje$/);
  await expect(sellerPage.getByRole("heading", { name: /^Olá,/ })).toBeVisible();

  await sellerContext.close();
});
