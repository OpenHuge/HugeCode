// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WebPwaLifecycle", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let registerServiceWorker: ReturnType<typeof vi.fn>;
  let waitingWorker: { postMessage: ReturnType<typeof vi.fn> } | null;
  let serviceWorkerListeners: Record<string, Array<() => void>>;

  beforeEach(() => {
    serviceWorkerListeners = {};
    waitingWorker = null;
    registerServiceWorker = vi.fn(async () => ({
      addEventListener: vi.fn(),
      update: vi.fn(async () => undefined),
      waiting: waitingWorker,
    }));
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register: registerServiceWorker,
        addEventListener: vi.fn((event: string, listener: () => void) => {
          serviceWorkerListeners[event] = [...(serviceWorkerListeners[event] ?? []), listener];
        }),
        removeEventListener: vi.fn((event: string, listener: () => void) => {
          serviceWorkerListeners[event] = (serviceWorkerListeners[event] ?? []).filter(
            (candidate) => candidate !== listener
          );
        }),
      },
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
  });

  async function renderLifecycle() {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const { WebPwaLifecycle } = await import("./WebPwaLifecycle");
    await act(async () => {
      root?.render(<WebPwaLifecycle />);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("renders the update CTA and forwards refresh requests to the waiting service worker", async () => {
    const postMessage = vi.fn();
    waitingWorker = { postMessage };
    registerServiceWorker.mockResolvedValue({
      addEventListener: vi.fn(),
      update: vi.fn(async () => undefined),
      waiting: waitingWorker,
    });

    await renderLifecycle();

    expect(registerServiceWorker).toHaveBeenCalledWith("/sw.js?app=0.1.0");

    const button = container?.querySelector("button");
    expect(container?.textContent).toContain("A newer HugeCode shell is available.");
    expect(button?.textContent).toBe("Update now");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  }, 20_000);

  it("renders an install CTA when beforeinstallprompt is available and dispatches prompt()", async () => {
    await renderLifecycle();

    const prompt = vi.fn(async () => undefined);
    const installEvent = new Event("beforeinstallprompt") as Event & {
      prompt: typeof prompt;
      preventDefault: () => void;
      platforms: string[];
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    installEvent.prompt = prompt;
    installEvent.platforms = ["web"];
    installEvent.userChoice = Promise.resolve({ outcome: "accepted" });

    await act(async () => {
      window.dispatchEvent(installEvent);
      await Promise.resolve();
    });

    const installButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Install HugeCode")
    );
    expect(container?.textContent).toContain("Launch the web workspace like an app.");

    await act(async () => {
      installButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  }, 20_000);
});
