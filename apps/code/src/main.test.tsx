/** @vitest-environment jsdom */
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryInitMock = vi.fn();
const sentryMetricsCountMock = vi.fn();

vi.mock("@sentry/react", () => ({
  init: sentryInitMock,
  metrics: {
    count: sentryMetricsCountMock,
  },
}));

vi.mock("./App", () => ({
  default: () => null,
}));
vi.mock("@ku0/ui/styles/globals", () => ({}));
vi.mock("./styles/runtime", () => ({}));

describe("main sentry bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryInitMock.mockClear();
    sentryMetricsCountMock.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("does not initialize sentry by default", async () => {
    await act(async () => {
      await import("./main");
      await vi.dynamicImportSettled();
    });

    expect(sentryInitMock).not.toHaveBeenCalled();
    expect(sentryMetricsCountMock).not.toHaveBeenCalled();
  });

  it("initializes sentry and records app_open when explicitly enabled", async () => {
    vi.stubEnv("VITE_SENTRY_ENABLED", "true");
    vi.stubEnv("VITE_SENTRY_DSN", "https://examplePublicKey@o0.ingest.us.sentry.io/0");
    await act(async () => {
      await import("./main");
      await vi.dynamicImportSettled();
    });
    await waitFor(() => {
      expect(sentryInitMock).toHaveBeenCalled();
    });
    expect(sentryInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://examplePublicKey@o0.ingest.us.sentry.io/0",
        enabled: true,
        release: expect.any(String),
      })
    );
    expect(sentryMetricsCountMock).toHaveBeenCalled();
    expect(sentryMetricsCountMock).toHaveBeenCalledWith(
      "app_open",
      1,
      expect.objectContaining({
        attributes: expect.objectContaining({
          platform: expect.stringMatching(/^(macos|windows|linux|unknown)$/),
          architecture: expect.stringMatching(/^(x64|arm64|x86|unknown)$/),
          platformArch: expect.stringMatching(
            /^(macos|windows|linux|unknown)-(x64|arm64|x86|unknown)$/
          ),
        }),
      })
    );
  });
});
