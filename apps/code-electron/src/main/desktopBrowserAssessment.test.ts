import { describe, expect, it, vi } from "vitest";
import {
  createDesktopBrowserAssessmentCapability,
  type CreateDesktopBrowserAssessmentCapabilityInput,
} from "./desktopBrowserAssessment.js";

describe("desktopBrowserAssessment", () => {
  it("assesses a localized target through the canonical proxy and reports a passing result", async () => {
    const executeJavaScript = vi
      .fn()
      .mockResolvedValueOnce({
        state: "ready",
        code: null,
        detail: null,
      })
      .mockResolvedValueOnce({
        selectorMatched: true,
        sourceUrl: "http://desktop-app/workspace/alpha",
        title: "Workspace alpha",
        html: '<main><h1>Workspace alpha</h1><button aria-label="Run">Run</button></main>',
        text: "Workspace alpha Run",
        childElementCount: 2,
        accessibilityFailures: [],
      });
    const close = vi.fn();
    const destroy = vi.fn();
    const on = vi.fn();
    const createWindow: CreateDesktopBrowserAssessmentCapabilityInput["createWindow"] = vi.fn(
      () => ({
        close,
        destroy,
        loadURL: vi.fn(async () => undefined),
        webContents: {
          executeJavaScript,
          on,
        },
      })
    );

    const capability = createDesktopBrowserAssessmentCapability({
      buildRendererUrl: (relativePath) => `hugecode-app://app/${relativePath.replace(/^\/+/u, "")}`,
      createTraceId: () => "browser-assessment-1",
      createWindow,
      now: () => "2026-03-30T00:00:00.000Z",
      wait: vi.fn(async () => undefined),
    });

    const result = await capability.assess({
      target: {
        kind: "route",
        routePath: "/workspace/alpha",
      },
      selector: "main",
      waitForMs: 1800,
    });

    expect(result.status).toBe("passed");
    expect(result.sourceUrl).toBe("http://desktop-app/workspace/alpha");
    expect(result.domSnapshot).toEqual({
      childElementCount: 2,
      html: '<main><h1>Workspace alpha</h1><button aria-label="Run">Run</button></main>',
      selector: "main",
      selectorMatched: true,
      text: "Workspace alpha Run",
    });
    expect(result.trace.map((entry) => entry.stage)).toEqual([
      "proxy",
      "render",
      "collect",
      "audit",
    ]);
    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith("console-message", expect.any(Function));
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    await expect(capability.getLastResult()).resolves.toEqual(result);
  });

  it("marks the assessment as failed when console errors or accessibility failures are detected", async () => {
    let consoleListener: ((...args: unknown[]) => void) | null = null;
    const executeJavaScript = vi
      .fn()
      .mockImplementationOnce(async () => {
        consoleListener?.({}, 3, "Unhandled render error", 18, "runtime-view.tsx");
        return {
          state: "ready",
          code: null,
          detail: null,
        };
      })
      .mockResolvedValueOnce({
        selectorMatched: true,
        sourceUrl: "http://desktop-app/fixtures.html?fixture=mission-control",
        title: "Mission Control",
        html: "<main><button></button></main>",
        text: "Run",
        childElementCount: 1,
        accessibilityFailures: [
          {
            code: "interactive-name-missing",
            message: "Interactive element is missing an accessible name.",
            selector: "button",
          },
        ],
      });
    const capability = createDesktopBrowserAssessmentCapability({
      buildRendererUrl: (relativePath) => `hugecode-app://app/${relativePath.replace(/^\/+/u, "")}`,
      createTraceId: () => "browser-assessment-2",
      createWindow: () => ({
        close: vi.fn(),
        loadURL: vi.fn(async () => undefined),
        webContents: {
          executeJavaScript,
          on: (_event, listener) => {
            consoleListener = listener as typeof consoleListener;
          },
        },
      }),
      now: () => "2026-03-30T00:00:01.000Z",
      wait: vi.fn(async () => undefined),
    });

    const result = await capability.assess({
      target: {
        kind: "fixture",
        fixtureName: "mission-control",
      },
      selector: "main",
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("BROWSER_A11Y_FAILURES_DETECTED");
    expect(result.consoleEntries).toEqual([
      {
        level: "error",
        message: "Unhandled render error",
        line: 18,
        sourceId: "runtime-view.tsx",
      },
    ]);
    expect(result.accessibilityFailures).toEqual([
      {
        code: "interactive-name-missing",
        message: "Interactive element is missing an accessible name.",
        selector: "button",
      },
    ]);
  });

  it("returns an error when the proxy blocks a recursive target", async () => {
    const capability = createDesktopBrowserAssessmentCapability({
      buildRendererUrl: (relativePath) => `hugecode-app://app/${relativePath.replace(/^\/+/u, "")}`,
      createTraceId: () => "browser-assessment-3",
      createWindow: () => ({
        close: vi.fn(),
        loadURL: vi.fn(async () => undefined),
        webContents: {
          executeJavaScript: vi.fn(async () => ({
            state: "blocked",
            code: "BROWSER_ASSESSMENT_PROXY_TARGET_INVALID",
            detail: "Browser assessment proxy cannot target itself as a route.",
          })),
          on: vi.fn(),
        },
      }),
      now: () => "2026-03-30T00:00:02.000Z",
      wait: vi.fn(async () => undefined),
    });

    const result = await capability.assess({
      target: {
        kind: "route",
        routePath: "/fixtures.html?fixture=browser-assessment-proxy",
      },
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("BROWSER_ASSESSMENT_PROXY_TARGET_INVALID");
    expect(result.errorMessage).toContain("cannot target itself");
    expect(result.trace.map((entry) => entry.stage)).toEqual(["proxy", "proxy"]);
  });
});
