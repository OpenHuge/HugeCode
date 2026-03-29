import { describe, expect, it, vi } from "vitest";
import {
  createDesktopBrowserExtractionCapability,
  type CreateDesktopBrowserExtractionCapabilityInput,
} from "./desktopBrowserExtraction.js";

describe("desktopBrowserExtraction", () => {
  it("extracts normalized browser text through the Chrome DevTools target", async () => {
    const fetchJson = vi.fn(async () => [
      {
        id: "page-1",
        type: "page",
        title: "Browser readiness",
        url: "https://example.com/browser-readiness",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/page-1",
      },
    ]);
    const evaluate = vi.fn(async () => ({
      title: "Browser readiness",
      sourceUrl: "https://example.com/browser-readiness",
      selectorMatched: true,
      text: "  Mission   Control browser extraction is now canonical.  ",
    }));
    const close = vi.fn();
    const connectToPageTarget: NonNullable<
      CreateDesktopBrowserExtractionCapabilityInput["connectToPageTarget"]
    > = vi.fn(async () => ({
      close,
      evaluate: async <T>() => (await evaluate()) as T,
    }));

    const capability = createDesktopBrowserExtractionCapability({
      connectToPageTarget,
      createTraceId: () => "browser-trace-1",
      fetchJson,
      listLocalChromeDebuggerEndpoints: () => [
        {
          browserName: "Google Chrome",
          discoverySource: "devtools-active-port",
          httpBaseUrl: "http://127.0.0.1:9222",
          profileLabel: "Default",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
        },
      ],
      now: () => "2026-03-30T00:00:00.000Z",
    });

    const result = await capability.extract({
      maxCharacters: 120,
      selector: "main",
      sourceUrl: "https://example.com/browser-readiness",
    });

    expect(result.status).toBe("succeeded");
    expect(result.normalizedText).toBe("Mission Control browser extraction is now canonical.");
    expect(result.snippet).toBe("Mission Control browser extraction is now canonical.");
    expect(result.sourceUrl).toBe("https://example.com/browser-readiness");
    expect(result.title).toBe("Browser readiness");
    expect(result.errorCode).toBeNull();
    expect(result.traceId).toBe("browser-trace-1");
    expect(result.trace.map((entry) => entry.stage)).toEqual([
      "availability",
      "capture",
      "extract",
      "normalize",
    ]);
    expect(fetchJson).toHaveBeenCalledWith("http://127.0.0.1:9222/json/list");
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    await expect(capability.getLastResult()).resolves.toEqual(result);
  });

  it("returns empty when the requested selector cannot be resolved on the page", async () => {
    const evaluate = vi.fn(async () => ({
      title: "Browser readiness",
      sourceUrl: "https://example.com/browser-readiness",
      selectorMatched: false,
      text: "",
    }));
    const connectToPageTarget: NonNullable<
      CreateDesktopBrowserExtractionCapabilityInput["connectToPageTarget"]
    > = vi.fn(async () => ({
      close: vi.fn(),
      evaluate: async <T>() => (await evaluate()) as T,
    }));

    const capability = createDesktopBrowserExtractionCapability({
      connectToPageTarget,
      createTraceId: () => "browser-trace-2",
      fetchJson: vi.fn(async () => [
        {
          id: "page-1",
          type: "page",
          title: "Browser readiness",
          url: "https://example.com/browser-readiness",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/page-1",
        },
      ]),
      listLocalChromeDebuggerEndpoints: () => [
        {
          browserName: "Google Chrome",
          discoverySource: "devtools-active-port",
          httpBaseUrl: "http://127.0.0.1:9222",
          profileLabel: "Default",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/browser-1",
        },
      ],
      now: () => "2026-03-30T00:00:01.000Z",
    });

    const result = await capability.extract({
      selector: "[data-test='missing']",
    });

    expect(result.status).toBe("empty");
    expect(result.errorCode).toBe("BROWSER_SELECTOR_NOT_FOUND");
    expect(result.errorMessage).toContain("selector");
    await expect(capability.getLastResult()).resolves.toEqual(result);
  });

  it("returns failed when no local Chrome debugger endpoint is available", async () => {
    const capability = createDesktopBrowserExtractionCapability({
      connectToPageTarget: vi.fn(),
      createTraceId: () => "browser-trace-3",
      fetchJson: vi.fn(),
      listLocalChromeDebuggerEndpoints: () => [],
      now: () => "2026-03-30T00:00:02.000Z",
    });

    const result = await capability.extract();

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("LOCAL_CHROME_DEBUGGER_UNAVAILABLE");
    expect(result.errorMessage).toContain("Chrome DevTools");
    expect(result.trace[0]?.stage).toBe("availability");
    await expect(capability.getLastResult()).resolves.toEqual(result);
  });
});
