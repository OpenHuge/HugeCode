import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootManagedPreview,
  extractObservedPreviewUrl,
  parsePreviewTargetCandidates,
} from "./runtimeBrowserWorkspacePreview";

describe("runtimeBrowserWorkspacePreview", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
      }))
    );
  });

  it("derives preview candidates from package scripts", () => {
    expect(
      parsePreviewTargetCandidates(
        JSON.stringify({
          packageManager: "pnpm@10.0.0",
          scripts: {
            dev: "vite --port 4444",
            preview: "vite preview",
            start: "next start",
          },
        })
      )
    ).toEqual([
      {
        id: "script:dev",
        label: "dev script",
        command: "pnpm dev",
        preferredUrl: "http://127.0.0.1:4444",
        scriptName: "dev",
        source: "package-script",
      },
      {
        id: "script:preview",
        label: "preview script",
        command: "pnpm preview",
        preferredUrl: "http://127.0.0.1:4173",
        scriptName: "preview",
        source: "package-script",
      },
      {
        id: "script:start",
        label: "start script",
        command: "pnpm start",
        preferredUrl: "http://127.0.0.1:3000",
        scriptName: "start",
        source: "package-script",
      },
    ]);
  });

  it("extracts observed loopback preview urls from terminal output", () => {
    expect(
      extractObservedPreviewUrl([
        "ready in 243ms",
        "Local: http://127.0.0.1:5173/",
        "Network: use --host to expose",
      ])
    ).toBe("http://127.0.0.1:5173/");
  });

  it("boots a managed preview from a script candidate", async () => {
    const ensurePreviewSession = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: "ws-preview",
        previewServerStatus: "starting",
      })
      .mockResolvedValueOnce({
        sessionId: "ws-preview",
        targetUrl: "http://127.0.0.1:5173/",
        previewServerStatus: "ready",
      });
    const result = await bootManagedPreview({
      workspaceId: "workspace-1",
      candidate: {
        id: "script:dev",
        label: "dev script",
        command: "pnpm dev",
        preferredUrl: "http://127.0.0.1:5173/",
        source: "package-script",
      },
      deps: {
        ensurePreviewSession,
        openRuntimeTerminalSession: vi.fn(async () => ({
          id: "terminal-1",
          workspaceId: "workspace-1",
          state: "created",
          createdAt: 1,
          updatedAt: 1,
          lines: [],
        })),
        readRuntimeTerminalSession: vi.fn(async () => ({
          id: "terminal-1",
          workspaceId: "workspace-1",
          state: "created",
          createdAt: 1,
          updatedAt: 2,
          lines: ["Local: http://127.0.0.1:5173/"],
        })),
        setPreviewSessionStatus: vi.fn(async () => ({
          sessionId: "ws-preview",
          previewServerStatus: "ready",
        })),
        writeRuntimeTerminalSession: vi.fn(async () => ({
          id: "terminal-1",
          workspaceId: "workspace-1",
          state: "created",
          createdAt: 1,
          updatedAt: 2,
          lines: ["starting"],
        })),
      },
    });

    expect(result.status).toBe("ready");
    expect(result.previewUrl).toBe("http://127.0.0.1:5173/");
    expect(result.terminalSessionId).toBe("terminal-1");
    expect(ensurePreviewSession).toHaveBeenNthCalledWith(1, {
      workspaceId: "workspace-1",
      targetUrl: "http://127.0.0.1:5173/",
      previewServerStatus: "starting",
    });
    expect(ensurePreviewSession).toHaveBeenNthCalledWith(2, {
      workspaceId: "workspace-1",
      targetUrl: "http://127.0.0.1:5173/",
      previewServerStatus: "ready",
    });
  });
});
