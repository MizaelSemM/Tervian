// Parsing da flag SIGNUPS_ENABLED em lib/env.ts (o resto do ambiente vem do .env de teste).
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env: SIGNUPS_ENABLED", () => {
  it("habilita cadastro quando a variável não foi configurada", async () => {
    vi.stubEnv("SIGNUPS_ENABLED", undefined);
    vi.resetModules();

    const { env } = await import("@/lib/env");
    expect(env.SIGNUPS_ENABLED).toBe(true);
  });

  it("desliga o cadastro com 'false' e liga com 'true'", async () => {
    vi.stubEnv("SIGNUPS_ENABLED", "false");
    vi.resetModules();
    expect((await import("@/lib/env")).env.SIGNUPS_ENABLED).toBe(false);

    vi.stubEnv("SIGNUPS_ENABLED", "true");
    vi.resetModules();
    expect((await import("@/lib/env")).env.SIGNUPS_ENABLED).toBe(true);
  });

  it("rejeita valores que não sejam 'true'/'false'", async () => {
    vi.stubEnv("SIGNUPS_ENABLED", "talvez");
    vi.resetModules();

    await expect(import("@/lib/env")).rejects.toThrow(/Variáveis de ambiente inválidas/);
  });
});
