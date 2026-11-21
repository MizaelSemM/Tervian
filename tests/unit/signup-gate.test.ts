// Flag operacional de novos cadastros — não depende de banco.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signupsEnabled: true }));

vi.mock("@/lib/env", () => ({
  env: {
    get SIGNUPS_ENABLED() {
      return mocks.signupsEnabled;
    },
  },
}));

import { AppError } from "@/server/errors";
import { SIGNUPS_CLOSED_MESSAGE, areSignupsOpen, assertSignupsOpen } from "@/server/signup-gate";

describe("flag de novos cadastros", () => {
  beforeEach(() => {
    mocks.signupsEnabled = true;
  });

  it("abre o cadastro quando a flag está ligada", () => {
    expect(areSignupsOpen()).toBe(true);
    expect(() => assertSignupsOpen()).not.toThrow();
  });

  it("fecha o cadastro quando a flag está desligada", () => {
    mocks.signupsEnabled = false;

    expect(areSignupsOpen()).toBe(false);
    expect(() => assertSignupsOpen()).toThrow(SIGNUPS_CLOSED_MESSAGE);
    try {
      assertSignupsOpen();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("SIGNUPS_CLOSED");
    }
  });
});
