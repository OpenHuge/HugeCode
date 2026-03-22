import { describe, expect, it, vi } from "vitest";

import {
  buildFixtureSmokePortErrorMessage,
  resolveFixtureSmokePort,
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
});
