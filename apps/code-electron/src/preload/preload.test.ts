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

  it("publishes browser assessment and extraction through the preload bridge", async () => {
    await import("./preload.js");

    const desktopHostBridge = exposeInMainWorldMock.mock.calls[0]?.[1] as {
      browserAssessment: {
        assess(input: unknown): Promise<unknown>;
        getLastResult(): Promise<unknown>;
      };
      browserExtraction: {
        extract(input?: unknown): Promise<unknown>;
        getLastResult(): Promise<unknown>;
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

    await desktopHostBridge.browserAssessment.assess(assessmentInput);
    await desktopHostBridge.browserAssessment.getLastResult();
    await desktopHostBridge.browserExtraction.extract(extractionInput);
    await desktopHostBridge.browserExtraction.getLastResult();

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      DESKTOP_HOST_IPC_CHANNELS.assessBrowserSurface,
      assessmentInput
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      DESKTOP_HOST_IPC_CHANNELS.getLastBrowserAssessmentResult
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      3,
      DESKTOP_HOST_IPC_CHANNELS.extractBrowserContent,
      extractionInput
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      4,
      DESKTOP_HOST_IPC_CHANNELS.getLastBrowserExtractionResult
    );
  });
});
