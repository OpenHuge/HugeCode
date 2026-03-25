import { describe, expect, it } from "vitest";

import { buildCodeE2EStartupEnv } from "../../scripts/lib/e2e-runtime-budgets.mjs";

describe("e2e-runtime-budgets", () => {
  it("raises startup budgets for smoke runs by default", () => {
    expect(buildCodeE2EStartupEnv({ category: "smoke", env: {} })).toMatchObject({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "480000",
      PW_WEBSERVER_TIMEOUT_MS: "540000",
    });
  });

  it("preserves explicit caller overrides", () => {
    expect(
      buildCodeE2EStartupEnv({
        category: "smoke",
        env: {
          CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "600000",
          PW_WEBSERVER_TIMEOUT_MS: "610000",
        },
      })
    ).toMatchObject({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "600000",
      PW_WEBSERVER_TIMEOUT_MS: "610000",
    });
  });

  it("leaves non-smoke categories unchanged", () => {
    expect(
      buildCodeE2EStartupEnv({
        category: "features",
        env: {
          CUSTOM_ENV: "1",
        },
      })
    ).toEqual({
      CUSTOM_ENV: "1",
    });
  });
});
