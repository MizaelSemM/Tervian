import { expect, test } from "@playwright/test";

import { signUp } from "./helpers";

/**
 * Importação de 5.000 linhas (009) — o mesmo cenário do critério da 014.
 * Roda apenas no desktop para não dobrar o tempo do CI; o fluxo mobile já é
 * coberto pelos demais testes no viewport de celular.
 */
test("importa 5.000 linhas e confere o relatório", async ({ page, isMobile }) => {
  test.skip(isMobile, "Importação pesada: coberta no projeto desktop.");
  test.setTimeout(300_000);

  await signUp(page, { companyName: "Empresa Import E2E" });

  const rows = ["Nome,Telefone"];
  for (let index = 0; index < 5_000; index += 1) {
    const phone = `119${String(10_000_000 + index)}`;
    rows.push(`Importado ${String(index).padStart(5, "0")},${phone}`);
  }

  await page.goto("/contatos/importar");
  await page.locator('input[type="file"]').setInputFiles({
    name: "contatos-5k.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(rows.join("\n"), "utf8"),
  });

  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByRole("heading", { name: "Pré-visualização" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("5000 linhas · 5000 válidas", { exact: false })).toBeVisible();

  await page
    .getByText("Declaro que tenho base legal para tratar estes dados, conforme a LGPD.")
    .click();
  await page.getByRole("button", { name: "Importar 5000 linhas" }).click();

  await expect(page.getByRole("heading", { name: "Resultado da importação" })).toBeVisible({
    timeout: 300_000,
  });
  await expect(
    page.getByText(
      "5000 linhas processadas · 5000 importadas · 0 atualizadas · 5000 novos negócios",
      { exact: false },
    ),
  ).toBeVisible();
});
