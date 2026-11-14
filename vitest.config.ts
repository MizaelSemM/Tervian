import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Banco remoto (Supabase): cada query custa ~200ms; o padrão de 5s aperta.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // O pooler do Supabase (session mode) limita 15 conexões. Localmente os
    // arquivos rodam em série para não esgotar o pool; no CI o Postgres
    // efêmero suporta o paralelismo padrão.
    fileParallelism: !process.env.CI,
  },
});
