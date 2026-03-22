import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEB_SERVER_TIMEOUT,
  parseWebServerTimeout,
} from "../../tests/e2e/playwright.config.shared";

describe("playwright webServer timeout parsing", () => {
  it("defaults high enough for cold runtime and Rust rebuilds", () => {
    expect(DEFAULT_WEB_SERVER_TIMEOUT).toBe(300_000);
    expect(parseWebServerTimeout(undefined)).toBe(300_000);
    expect(parseWebServerTimeout("0")).toBe(300_000);
  });

  it("accepts explicit timeout overrides in milliseconds", () => {
    expect(parseWebServerTimeout("450000")).toBe(450_000);
  });
});
