import { describe, expect, it, vi } from "vitest";
import {
  createDesktopAiWebLabController,
  getAiWebLabManagedPartition,
  isAiWebLabAllowedUrl,
  normalizeAiWebLabUrl,
} from "./desktopAiWebLab.js";

function createAiWebLabWindow() {
  let closedHandler: (() => void) | null = null;
  let readyHandler: (() => void) | null = null;
  let visible = false;
  let currentUrl = "";
  let title = "AI Web Lab";
  const didNavigateHandlers: Array<(event: unknown, url: string) => void> = [];
  const window = {
    close: vi.fn(() => {
      visible = false;
      closedHandler?.();
    }),
    focus: vi.fn(),
    getTitle: vi.fn(() => title),
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => visible),
    loadURL: vi.fn(async (url: string) => {
      currentUrl = url;
      didNavigateHandlers.forEach((handler) => handler({}, url));
    }),
    once: vi.fn((event: "ready-to-show", listener: () => void) => {
      if (event === "ready-to-show") {
        readyHandler = listener;
      }
    }),
    on: vi.fn((event: "closed", listener: () => void) => {
      if (event === "closed") {
        closedHandler = listener;
      }
    }),
    show: vi.fn(() => {
      visible = true;
    }),
    webContents: {
      executeJavaScript: vi.fn(),
      getURL: vi.fn(() => currentUrl),
      on: vi.fn((event: string, listener: (...args: unknown[]) => unknown) => {
        if (event === "did-navigate") {
          didNavigateHandlers.push(listener as (event: unknown, url: string) => void);
        }
      }),
      setWindowOpenHandler: vi.fn(),
    },
  };

  return {
    window,
    emitReady() {
      readyHandler?.();
    },
    setTitle(nextTitle: string) {
      title = nextTitle;
    },
  };
}

describe("desktopAiWebLab", () => {
  it("opens a managed ChatGPT session and extracts the fenced artifact", async () => {
    const aiWebLabWindow = createAiWebLabWindow();
    aiWebLabWindow.window.webContents.executeJavaScript = vi.fn(async () => ({
      status: "succeeded",
      content: "```markdown\nfinal prompt\n```",
      sourceUrl: "https://chatgpt.com/c/example",
      pageTitle: "ChatGPT Prompt Lab",
    }));
    const create = vi.fn(() => aiWebLabWindow.window);
    const ensureManagedSessionSecurity = vi.fn();

    const controller = createDesktopAiWebLabController({
      browserWindow: { create },
      ensureManagedSessionSecurity,
      isSafeExternalUrl: () => true,
      listLocalChromeDebuggerEndpoints: () => [],
      openExternalUrl: vi.fn(),
    });

    const state = await controller.openSession({
      providerId: "chatgpt",
      preferredSessionMode: "managed",
      preferredViewMode: "window",
      url: "https://chatgpt.com/",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(ensureManagedSessionSecurity).toHaveBeenCalledWith("chatgpt");
    expect(aiWebLabWindow.window.loadURL).toHaveBeenCalledWith("https://chatgpt.com/");
    expect(state.providerId).toBe("chatgpt");
    expect(state.sessionMode).toBe("managed");

    aiWebLabWindow.emitReady();
    aiWebLabWindow.setTitle("ChatGPT Prompt Lab");

    const artifact = await controller.extractArtifact();
    expect(artifact.providerId).toBe("chatgpt");
    expect(artifact.artifactKind).toBe("prompt_markdown");
    expect(artifact.status).toBe("succeeded");
    expect(artifact.content).toContain("final prompt");
  });

  it("opens a Gemini entrypoint and extracts text content", async () => {
    const aiWebLabWindow = createAiWebLabWindow();
    aiWebLabWindow.window.webContents.executeJavaScript = vi.fn(async () => ({
      status: "succeeded",
      content: "Gemini canvas content",
      sourceUrl: "https://gemini.google.com/app",
      pageTitle: "Gemini",
    }));

    const controller = createDesktopAiWebLabController({
      browserWindow: { create: vi.fn(() => aiWebLabWindow.window) },
      ensureManagedSessionSecurity: vi.fn(),
      isSafeExternalUrl: () => true,
      listLocalChromeDebuggerEndpoints: () => [],
      openExternalUrl: vi.fn(),
    });

    const state = await controller.openEntrypoint("gemini", "canvas");
    expect(state.providerId).toBe("gemini");
    expect(state.activeEntrypointId).toBe("canvas");

    const artifact = await controller.extractArtifact();
    expect(artifact.providerId).toBe("gemini");
    expect(artifact.artifactKind).toBe("canvas_document");
    expect(artifact.content).toBe("Gemini canvas content");
  });

  it("normalizes provider URLs and enforces the allowlist", () => {
    expect(getAiWebLabManagedPartition("chatgpt")).toBe("persist:hugecode-ai-web-lab:chatgpt");
    expect(getAiWebLabManagedPartition("gemini")).toBe("persist:hugecode-ai-web-lab:gemini");
    expect(normalizeAiWebLabUrl("chatgpt", "https://chatgpt.com/g/g-123")).toBe(
      "https://chatgpt.com/g/g-123"
    );
    expect(normalizeAiWebLabUrl("gemini", "javascript:alert(1)")).toBe(
      "https://gemini.google.com/app"
    );
    expect(isAiWebLabAllowedUrl("https://chatgpt.com/c/prompt-lab")).toBe(true);
    expect(isAiWebLabAllowedUrl("https://gemini.google.com/app")).toBe(true);
    expect(isAiWebLabAllowedUrl("https://github.com/OpenHuge/HugeCode")).toBe(true);
    expect(isAiWebLabAllowedUrl("https://example.com/")).toBe(false);
  });
});
