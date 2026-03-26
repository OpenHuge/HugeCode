// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPwaDocumentState,
  detectManualInstallPlatform,
  detectPwaDisplayMode,
  isStandaloneLikeDisplayMode,
  readDismissedInstallPrompt,
  resolveLaunchNavigationTarget,
  resolveServiceWorkerPath,
  writeDismissedInstallPrompt,
} from "./browserPwa";

describe("browserPwa helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    });
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(display-mode: browser-never-matches)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it("detects standalone-like display modes", () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    expect(detectPwaDisplayMode()).toBe("standalone");
    expect(isStandaloneLikeDisplayMode("standalone")).toBe(true);
    expect(isStandaloneLikeDisplayMode("browser")).toBe(false);
  });

  it("detects Apple manual-install platforms without treating Chromium as Safari", () => {
    expect(
      detectManualInstallPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1"
      )
    ).toBe("ios");
    expect(
      detectManualInstallPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15"
      )
    ).toBe("safari-desktop");
    expect(
      detectManualInstallPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36"
      )
    ).toBe(null);
  });

  it("persists dismissed install prompts and mirrors PWA state into document datasets", () => {
    expect(readDismissedInstallPrompt()).toBe(false);
    writeDismissedInstallPrompt(true);
    expect(readDismissedInstallPrompt()).toBe(true);

    applyPwaDocumentState({
      displayMode: "window-controls-overlay",
      online: false,
    });

    expect(document.documentElement.dataset.pwaDisplayMode).toBe("window-controls-overlay");
    expect(document.documentElement.dataset.pwaInstalled).toBe("true");
    expect(document.documentElement.dataset.pwaOnline).toBe("false");
  });

  it("builds a versioned service worker URL and preserves workspace sessions on redundant relaunches", () => {
    expect(resolveServiceWorkerPath("9.9.9")).toBe("/sw.js?app=9.9.9");
    expect(
      resolveLaunchNavigationTarget({
        currentUrl: "https://hugecode.dev/app",
        targetUrl: "https://hugecode.dev/app?source=pwa",
      })
    ).toBe(null);
    expect(
      resolveLaunchNavigationTarget({
        currentUrl: "https://hugecode.dev/about",
        targetUrl: "https://hugecode.dev/app?source=pwa",
      })
    ).toBe("/app?source=pwa");
  });
});
