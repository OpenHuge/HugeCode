import { describe, expect, it, vi } from "vitest";

import {
  buildFixtureSmokeEnv,
  buildFixtureSmokePortErrorMessage,
  resolveFixtureSmokePort,
  resolveFixtureSmokeRuntimePort,
} from "../../scripts/run-design-system-fixture-smoke.mjs";

describe("run-design-system-fixture-smoke", () => {
  it("reuses WEB_E2E_PORT when the caller already selected a port", async () => {
    const resolveAvailablePort = vi.fn();

    await expect(
      resolveFixtureSmokePort({
        env: {
          WEB_E2E_PORT: "5488",
        },
        resolveAvailablePort,
      })
    ).resolves.toBe(5488);

    expect(resolveAvailablePort).not.toHaveBeenCalled();
  });

  it("wraps EPERM port probe failures with an actionable message", () => {
    const message = buildFixtureSmokePortErrorMessage(5197, {
      code: "EPERM",
      message: "listen EPERM: operation not permitted 127.0.0.1:5197",
    });

    expect(message).toContain("could not probe a local port");
    expect(message).toContain("EPERM");
    expect(message).toContain("WEB_E2E_PORT");
  });

  it("uses higher cold-start budgets for fixture smoke by default", () => {
    expect(buildFixtureSmokeEnv({}, 5197, 8788)).toMatchObject({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "480000",
      CODE_RUNTIME_SERVICE_PORT: "8788",
      PW_WEBSERVER_TIMEOUT_MS: "540000",
      WEB_E2E_PORT: "5197",
    });
  });

  it("preserves explicit timeout overrides from the caller", () => {
    expect(
      buildFixtureSmokeEnv(
        {
          CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "600000",
          CODE_RUNTIME_SERVICE_PORT: "9901",
          PW_WEBSERVER_TIMEOUT_MS: "610000",
        },
        5300,
        9901
      )
    ).toMatchObject({
      CODE_RUNTIME_SERVICE_READY_TIMEOUT_MS: "600000",
      CODE_RUNTIME_SERVICE_PORT: "9901",
      PW_WEBSERVER_TIMEOUT_MS: "610000",
      WEB_E2E_PORT: "5300",
    });
  });

  it("reuses CODE_RUNTIME_SERVICE_PORT when the caller already selected a runtime port", async () => {
    const resolveAvailablePort = vi.fn();

    await expect(
      resolveFixtureSmokeRuntimePort({
        env: {
          CODE_RUNTIME_SERVICE_PORT: "8899",
        },
        resolveAvailablePort,
      })
    ).resolves.toBe(8899);

    expect(resolveAvailablePort).not.toHaveBeenCalled();
  });
});
