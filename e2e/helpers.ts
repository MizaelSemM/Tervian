import { expect, type Page } from "@playwright/test";

/**
 * Helpers dos testes E2E (tarefa 014).
 *
 * Cada teste cria a própria conta/tenant — nunca dependemos de dados de
 * produção nem de ordem de execução. Os dados são únicos por execução para
 * que o CI possa rodar a suíte mais de uma vez no mesmo banco.
 */

let sequence = 0;

export function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}${sequence.toString(36)}`;
}

export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${uniqueSuffix()}@tervian.test`;
}

/** Telefone celular BR válido (DDD 11 + 9 + 8 dígitos), único o bastante. */
export function uniquePhone(): string {
  const digits = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return `119${digits}`;
}

export const TEST_PASSWORD = "senha-e2e-123";

export async function signUp(
  page: Page,
  options: { companyName?: string; name?: string; email?: string } = {},
): Promise<{ email: string; name: string; companyName: string }> {
  const suffix = uniqueSuffix();
  const email = options.email ?? uniqueEmail("admin");
  const name = options.name ?? `Admin E2E ${suffix}`;
  const companyName = options.companyName ?? `Empresa E2E ${suffix}`;

  await page.goto("/cadastro");
  await page.getByLabel("Nome da empresa", { exact: true }).fill(companyName);
  await page.getByLabel("Seu nome", { exact: true }).fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();

  // O cadastro cria a sessão e redireciona para a tela "Hoje".
  await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);

  return { email, name, companyName };
}

export async function login(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible({ timeout: 20_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Cria um lead pela captura rápida e devolve a URL do contato. */
export async function createLead(
  page: Page,
  input: { name: string; phone?: string },
): Promise<{ phone: string; contactUrl: string }> {
  const phone = input.phone ?? uniquePhone();

  await page.goto("/contatos/novo");
  await page.getByLabel("Nome", { exact: true }).fill(input.name);
  await page.getByLabel("Telefone", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Salvar lead" }).click();

  await expect(page).toHaveURL(/\/contatos\/[^/?]+\?novo=1/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: input.name, exact: true })).toBeVisible();

  return { phone, contactUrl: page.url() };
}

/** Slug do formulário público configurado para a conta atual. */
export async function publicFormSlug(page: Page): Promise<string> {
  await page.goto("/configuracoes");
  return page.locator("#public-form-slug").inputValue();
}
