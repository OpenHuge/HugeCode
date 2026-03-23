import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureDesktopBrowserDebugSession,
  getDesktopBrowserDebugSession,
} from "./desktopBrowserDebug";

describe("desktopBrowserDebug", () => {
  beforeEach(() => {
    delete window.hugeCodeDesktopHost;
  });

  it("returns null when the desktop browser debug bridge is unavailable", async () => {
    await expect(getDesktopBrowserDebugSession()).resolves.toBeNull();
    await expect(ensureDesktopBrowserDebugSession()).resolves.toBeNull();
  });

  it("normalizes valid browser debug session payloads from the Electron bridge", async () => {
    window.hugeCodeDesktopHost = {
      kind: "electron",
      browserDebug: {
        getSession: async () => ({
          browserUrl: " http://127.0.0.1:9333 ",
          currentUrl: " https://chatgpt.com/ ",
          targetUrl: " https://chatgpt.com/ ",
          windowId: 41,
        }),
        ensureSession: async () => ({
          browserUrl: " http://127.0.0.1:9333 ",
          currentUrl: " https://example.com/ ",
          targetUrl: " https://example.com/ ",
          windowId: 42,
        }),
      },
    };

    await expect(getDesktopBrowserDebugSession()).resolves.toEqual({
      browserUrl: "http://127.0.0.1:9333",
      currentUrl: "https://chatgpt.com/",
      targetUrl: "https://chatgpt.com/",
      windowId: 41,
    });
    await expect(
      ensureDesktopBrowserDebugSession({
        targetUrl: "https://example.com/",
        focus: false,
      })
    ).resolves.toEqual({
      browserUrl: "http://127.0.0.1:9333",
      currentUrl: "https://example.com/",
      targetUrl: "https://example.com/",
      windowId: 42,
    });
  });

  it("rejects malformed bridge payloads", async () => {
    window.hugeCodeDesktopHost = {
      kind: "electron",
      browserDebug: {
        getSession: async () => ({
          browserUrl: "",
          currentUrl: null,
          targetUrl: null,
          windowId: 0,
        }),
        ensureSession: async () => ({
          browserUrl: "http://127.0.0.1:9333",
          currentUrl: null,
          targetUrl: null,
          windowId: Number.NaN,
        }),
      },
    };

    await expect(getDesktopBrowserDebugSession()).resolves.toBeNull();
    await expect(ensureDesktopBrowserDebugSession()).resolves.toBeNull();
  });
});
