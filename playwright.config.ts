import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E (ver .notes/014-testes-qa.md).
 * Regra do produto: o vendedor usa celular — o mobile é o alvo de teste principal.
 *
 * Um worker só: os testes criam contas reais no banco efêmero e o Better Auth
 * limita tentativas de login por IP. Em troca, cada teste tem a própria conta,
 * então a ordem não importa.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
});
