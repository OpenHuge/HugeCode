import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "@ku0/code-platform-interfaces";

const invokeMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();
const exposeInMainWorldMock = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: exposeInMainWorldMock,
  },
  ipcRenderer: {
    invoke: invokeMock,
    on: onMock,
    off: offMock,
  },
}));

describe("preload desktop host bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
    onMock.mockReset();
    offMock.mockReset();
    exposeInMainWorldMock.mockReset();
  });

  it("publishes core/event plus AI Web Lab and browser tooling through the preload bridge", async () => {
    await import("./preload.js");

    const desktopHostBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      core: {
        invoke(input: string, payload?: unknown): Promise<unknown>;
      };
      event: {
        listen(
          eventName: string,
          listener: (event: { payload: unknown }) => void
        ): Promise<() => void>;
      };
      browserAssessment: {
        assess(input: unknown): Promise<unknown>;
        getLastResult(): Promise<unknown>;
      };
      browserExtraction: {
        extract(input?: unknown): Promise<unknown>;
        getLastResult(): Promise<unknown>;
      };
      aiWebLab: {
        closeSession(): Promise<unknown>;
        extractArtifact(): Promise<unknown>;
        focusSession(): Promise<unknown>;
        getCatalog(): Promise<unknown>;
        getState(): Promise<unknown>;
        navigate(input: unknown): Promise<unknown>;
        openEntrypoint(providerId: string, entrypointId: string): Promise<unknown>;
        openSession(input?: unknown): Promise<unknown>;
        setSessionMode(mode: string): Promise<unknown>;
        setViewMode(mode: string): Promise<unknown>;
      };
    };

    expect(exposeInMainWorldMock).toHaveBeenCalledWith("hugeCodeDesktopHost", expect.any(Object));

    const assessmentInput = {
      target: {
        kind: "fixture",
        fixtureName: "mission-control",
      },
      selector: "main",
    };
    const extractionInput = {
      selector: "main",
      maxCharacters: 320,
      sourceUrl: "https://example.com/browser-readiness",
    };
    const aiWebLabInput = {
      providerId: "gemini",
      preferredSessionMode: "managed",
      preferredViewMode: "window",
      url: "https://gemini.google.com/app",
    };

    const detach = await desktopHostBridge.event.listen(
      "fastcode://runtime/event",
      () => undefined
    );
    await desktopHostBridge.core.invoke("get_config_model", { workspaceId: "ws-1" });
    await desktopHostBridge.aiWebLab.getCatalog();
    await desktopHostBridge.aiWebLab.getState();
    await desktopHostBridge.aiWebLab.openSession(aiWebLabInput);
    await desktopHostBridge.aiWebLab.openEntrypoint("gemini", "canvas");
    await desktopHostBridge.aiWebLab.focusSession();
    await desktopHostBridge.aiWebLab.closeSession();
    await desktopHostBridge.aiWebLab.setViewMode("window");
    await desktopHostBridge.aiWebLab.setSessionMode("attached");
    await desktopHostBridge.aiWebLab.navigate({
      providerId: "gemini",
      entrypointId: "canvas",
      url: "https://gemini.google.com/app",
    });
    await desktopHostBridge.aiWebLab.extractArtifact();
    await desktopHostBridge.browserAssessment.assess(assessmentInput);
    await desktopHostBridge.browserAssessment.getLastResult();
    await desktopHostBridge.browserExtraction.extract(extractionInput);
    await desktopHostBridge.browserExtraction.getLastResult();
    detach();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "get_config_model", { workspaceId: "ws-1" });
    expect(onMock).toHaveBeenCalledWith("fastcode://runtime/event", expect.any(Function));
    expect(offMock).toHaveBeenCalledWith("fastcode://runtime/event", expect.any(Function));
    expect(invokeMock).toHaveBeenNthCalledWith(2, DESKTOP_HOST_IPC_CHANNELS.getAiWebLabCatalog);
    expect(invokeMock).toHaveBeenNthCalledWith(3, DESKTOP_HOST_IPC_CHANNELS.getAiWebLabState);
    expect(invokeMock).toHaveBeenNthCalledWith(
      4,
      DESKTOP_HOST_IPC_CHANNELS.openAiWebLabSession,
      aiWebLabInput
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      5,
      DESKTOP_HOST_IPC_CHANNELS.openAiWebLabEntrypoint,
      "gemini",
      "canvas"
    );
    expect(invokeMock).toHaveBeenNthCalledWith(6, DESKTOP_HOST_IPC_CHANNELS.focusAiWebLabSession);
    expect(invokeMock).toHaveBeenNthCalledWith(7, DESKTOP_HOST_IPC_CHANNELS.closeAiWebLabSession);
    expect(invokeMock).toHaveBeenNthCalledWith(
      8,
      DESKTOP_HOST_IPC_CHANNELS.setAiWebLabViewMode,
      "window"
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      9,
      DESKTOP_HOST_IPC_CHANNELS.setAiWebLabSessionMode,
      "attached"
    );
    expect(invokeMock).toHaveBeenNthCalledWith(10, DESKTOP_HOST_IPC_CHANNELS.navigateAiWebLab, {
      providerId: "gemini",
      entrypointId: "canvas",
      url: "https://gemini.google.com/app",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(
      11,
      DESKTOP_HOST_IPC_CHANNELS.extractAiWebLabArtifact
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      12,
      DESKTOP_HOST_IPC_CHANNELS.assessBrowserSurface,
      assessmentInput
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      13,
      DESKTOP_HOST_IPC_CHANNELS.getLastBrowserAssessmentResult
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      14,
      DESKTOP_HOST_IPC_CHANNELS.extractBrowserContent,
      extractionInput
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      15,
      DESKTOP_HOST_IPC_CHANNELS.getLastBrowserExtractionResult
    );
  });
});
