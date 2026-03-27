import { describe, expect, it } from "vitest";

import {
  buildCodeE2EStartupEnv,
  resolveCodeRuntimeServicePrewarmPolicy,
} from "../../scripts/lib/e2e-runtime-budgets.mjs";

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

  it("prewarms the runtime service for smoke runs by default", () => {
    expect(resolveCodeRuntimeServicePrewarmPolicy({ category: "smoke", env: {} })).toEqual({
      enabled: true,
      reason: "smoke runs prewarm the Rust runtime service to reduce cold-cache startup variance",
    });
  });

  it("prewarms the runtime service for CI-backed e2e runs", () => {
    expect(
      resolveCodeRuntimeServicePrewarmPolicy({
        category: "features",
        env: {
          CI: "true",
        },
      })
    ).toEqual({
      enabled: true,
      reason: "CI runs prewarm the Rust runtime service to reduce cold-cache startup variance",
    });
  });

  it("respects explicit runtime prewarm overrides", () => {
    expect(
      resolveCodeRuntimeServicePrewarmPolicy({
        category: "smoke",
        env: {
          CODE_RUNTIME_E2E_PREWARM: "false",
        },
      })
    ).toEqual({
      enabled: false,
      reason: "disabled by CODE_RUNTIME_E2E_PREWARM override",
    });
    expect(
      resolveCodeRuntimeServicePrewarmPolicy({
        category: "features",
        env: {
          CODE_RUNTIME_E2E_PREWARM: "true",
        },
      })
    ).toEqual({
      enabled: true,
      reason: "explicit CODE_RUNTIME_E2E_PREWARM override",
    });
  });
});
