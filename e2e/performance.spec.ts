import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * Critério de performance da 014: "Hoje" em menos de 2s com 200 tarefas e 4G.
 * O cenário é criado por `e2e/seed-perf.ts` (conta demo do seed).
 */
test("Hoje responde em menos de 2s com 200 tarefas em 4G", async ({ page, isMobile }) => {
  test.skip(isMobile, "Medição de rede é feita uma vez, no projeto desktop.");

  await login(page, "bruno@demo.tervian.dev", "demo1234");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20, // 4G: ~20ms de ida e volta
    downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps
    uploadThroughput: (3 * 1024 * 1024) / 8, // 3 Mbps
    connectionType: "cellular4g",
  });

  const startedAt = Date.now();
  await page.goto("/hoje", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible();
  const elapsedMs = Date.now() - startedAt;

  console.log(`[e2e] /hoje com 200 tarefas em 4G: ${elapsedMs}ms`);
  expect(elapsedMs).toBeLessThan(2_000);

  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "none",
  });
});
