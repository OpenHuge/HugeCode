// @vitest-environment jsdom

import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForDesktopUpdates,
  detectDesktopRuntimeHost,
  resolveDesktopUpdaterState,
  restartDesktopUpdate,
} from "../../../application/runtime/facades/desktopHostFacade";
import type { DebugEntry } from "../../../types";
import { STORAGE_KEY_PENDING_POST_UPDATE_VERSION } from "../utils/postUpdateRelease";
import { useUpdater } from "./useUpdater";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("../../../application/runtime/facades/desktopHostFacade", () => ({
  checkForDesktopUpdates: vi.fn(),
  detectDesktopRuntimeHost: vi.fn(async () => "tauri"),
  resolveDesktopUpdaterState: vi.fn(async () => ({
    capability: "unsupported",
    message: "Automatic desktop updates are unavailable in this environment.",
    mode: "unsupported_platform",
    provider: "none",
    stage: "idle",
  })),
  restartDesktopUpdate: vi.fn(async () => false),
}));

const checkMock = vi.mocked(check);
const relaunchMock = vi.mocked(relaunch);
const checkForDesktopUpdatesMock = vi.mocked(checkForDesktopUpdates);
const detectDesktopRuntimeHostMock = vi.mocked(detectDesktopRuntimeHost);
const resolveDesktopUpdaterStateMock = vi.mocked(resolveDesktopUpdaterState);
const restartDesktopUpdateMock = vi.mocked(restartDesktopUpdate);
const fetchMock = vi.fn();
type CheckResult = Awaited<ReturnType<typeof check>>;
const APP_VERSION = "1.2.3";
const asCheckResult = (value: Record<string, unknown>): CheckResult =>
  value as unknown as CheckResult;

describe("useUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("__APP_VERSION__", APP_VERSION);
    detectDesktopRuntimeHostMock.mockResolvedValue("tauri");
    checkForDesktopUpdatesMock.mockResolvedValue({
      capability: "automatic",
      mode: "enabled_stable_public_service",
      provider: "public-github",
      stage: "checking",
      version: "2.0.0",
    });
    resolveDesktopUpdaterStateMock.mockResolvedValue({
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable in this environment.",
      mode: "unsupported_platform",
      provider: "none",
      stage: "idle",
    });
    restartDesktopUpdateMock.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sets error state when update check fails", async () => {
    checkMock.mockRejectedValue(new Error("nope"));
    const onDebug = vi.fn();
    const { result } = renderHook(() => useUpdater({ onDebug }));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(result.current.state.stage).toBe("error");
    expect(result.current.state.error).toBe("nope");
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(Number),
        label: "updater/error",
        source: "error",
        payload: "nope",
      } satisfies Partial<DebugEntry>)
    );
  });

  it("returns to idle when no update is available", async () => {
    checkMock.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(result.current.state.stage).toBe("idle");
  });

  it("announces when no update is available for manual checks", async () => {
    vi.useFakeTimers();
    checkMock.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.checkForUpdates({ announceNoUpdate: true });
    });

    expect(result.current.state.stage).toBe("latest");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.state.stage).toBe("idle");
  });

  it("surfaces explicit manual-update messaging for electron beta builds without auto-update", async () => {
    detectDesktopRuntimeHostMock.mockResolvedValue("electron");
    checkForDesktopUpdatesMock.mockResolvedValue({
      capability: "manual",
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      mode: "disabled_beta_manual",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "2.0.0-beta.3",
    });
    resolveDesktopUpdaterStateMock.mockResolvedValue({
      capability: "manual",
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      mode: "disabled_beta_manual",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "2.0.0-beta.3",
    });

    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.checkForUpdates({ announceNoUpdate: true });
    });

    expect(result.current.state).toEqual({
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "manual",
      version: "2.0.0-beta.3",
    });
    expect(resolveDesktopUpdaterStateMock).toHaveBeenCalledTimes(1);
  });

  it("downloads and restarts when update is available", async () => {
    const close = vi.fn();
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 40 } });
      onEvent({ event: "Progress", data: { chunkLength: 60 } });
      onEvent({ event: "Finished", data: {} });
    });
    checkMock.mockResolvedValue(
      asCheckResult({
        version: "1.2.3",
        downloadAndInstall,
        close,
      })
    );

    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(result.current.state.stage).toBe("available");
    expect(result.current.state.version).toBe("1.2.3");

    await act(async () => {
      await result.current.startUpdate();
    });

    await waitFor(() => expect(result.current.state.stage).toBe("restarting"));
    expect(result.current.state.progress?.totalBytes).toBe(100);
    expect(result.current.state.progress?.downloadedBytes).toBe(100);
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION)).toBe("1.2.3");
  });

  it("resets to idle and closes update on dismiss", async () => {
    const close = vi.fn();
    checkMock.mockResolvedValue(
      asCheckResult({
        version: "1.0.0",
        downloadAndInstall: vi.fn(),
        close,
      })
    );
    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.startUpdate();
    });

    await act(async () => {
      await result.current.dismiss();
    });

    expect(result.current.state.stage).toBe("idle");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("surfaces download errors and keeps progress", async () => {
    const close = vi.fn();
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 50 } });
      onEvent({ event: "Progress", data: { chunkLength: 20 } });
      throw new Error("download failed");
    });
    checkMock.mockResolvedValue(
      asCheckResult({
        version: "2.0.0",
        downloadAndInstall,
        close,
      })
    );
    const onDebug = vi.fn();
    const { result } = renderHook(() => useUpdater({ onDebug }));

    await act(async () => {
      await result.current.startUpdate();
    });

    await act(async () => {
      await result.current.startUpdate();
    });

    await waitFor(() => expect(result.current.state.stage).toBe("error"));
    expect(result.current.state.error).toBe("download failed");
    expect(result.current.state.progress?.downloadedBytes).toBe(20);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        timestamp: expect.any(Number),
        label: "updater/error",
        source: "error",
        payload: "download failed",
      } satisfies Partial<DebugEntry>)
    );
  });

  it("does not run updater workflow when disabled", async () => {
    checkMock.mockResolvedValue(
      asCheckResult({
        version: "9.9.9",
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      })
    );
    const { result } = renderHook(() => useUpdater({ enabled: false }));

    await act(async () => {
      await result.current.checkForUpdates({ announceNoUpdate: true });
      await result.current.startUpdate();
    });

    expect(checkMock).not.toHaveBeenCalled();
    expect(result.current.state.stage).toBe("idle");
  });

  it("silently returns to idle when updater plugin is unavailable", async () => {
    checkMock.mockRejectedValue(new Error("plugin:updater|check not allowed"));
    const onDebug = vi.fn();
    const { result } = renderHook(() => useUpdater({ onDebug }));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(result.current.state.stage).toBe("idle");
    expect(result.current.state.error).toBeUndefined();
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("uses the desktop bridge updater flow on electron and restarts after download", async () => {
    detectDesktopRuntimeHostMock.mockResolvedValue("electron");
    checkForDesktopUpdatesMock.mockResolvedValue({
      capability: "automatic",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      stage: "checking",
      version: "2.0.0",
    });
    resolveDesktopUpdaterStateMock
      .mockResolvedValueOnce({
        capability: "automatic",
        mode: "enabled_beta_static_feed",
        provider: "static-storage",
        stage: "downloaded",
        version: "2.0.0",
      })
      .mockResolvedValue({
        capability: "automatic",
        mode: "enabled_beta_static_feed",
        provider: "static-storage",
        stage: "downloaded",
        version: "2.0.0",
      });
    restartDesktopUpdateMock.mockResolvedValue(true);

    const { result } = renderHook(() => useUpdater({}));

    await act(async () => {
      await result.current.checkForUpdates();
    });

    await waitFor(() => expect(result.current.state.stage).toBe("downloaded"));

    await act(async () => {
      await result.current.startUpdate();
    });

    expect(result.current.state.stage).toBe("restarting");
    expect(checkForDesktopUpdatesMock).toHaveBeenCalledTimes(1);
    expect(restartDesktopUpdateMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION)).toBe("2.0.0");
  });

  it("loads post-update release notes after restart when marker matches current version", async () => {
    window.localStorage.setItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION, APP_VERSION);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: `v${APP_VERSION}`,
        html_url: `https://github.com/byoungd/keep-up/releases/tag/v${APP_VERSION}`,
        body: "## New\n- Added updater notes",
      }),
    } as Response);

    const { result } = renderHook(() => useUpdater({}));

    await waitFor(() => expect(result.current.postUpdateNotice?.stage).toBe("ready"));

    expect(result.current.postUpdateNotice).toMatchObject({
      stage: "ready",
      version: APP_VERSION,
      htmlUrl: `https://github.com/byoungd/keep-up/releases/tag/v${APP_VERSION}`,
      body: "## New\n- Added updater notes",
    });

    await act(async () => {
      result.current.dismissPostUpdateNotice();
    });
    expect(result.current.postUpdateNotice).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION)).toBeNull();
  });

  it("shows post-update fallback when release notes fetch fails", async () => {
    window.localStorage.setItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION, APP_VERSION);
    fetchMock.mockRejectedValue(new Error("offline"));
    const onDebug = vi.fn();
    const { result } = renderHook(() => useUpdater({ onDebug }));

    await waitFor(() => expect(result.current.postUpdateNotice?.stage).toBe("fallback"));

    expect(result.current.postUpdateNotice).toMatchObject({
      stage: "fallback",
      version: APP_VERSION,
      htmlUrl: `https://github.com/byoungd/keep-up/releases/tag/v${APP_VERSION}`,
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "updater/release-notes-error",
        source: "error",
      })
    );
  });

  it("does not reopen post-update toast after dismissing during loading", async () => {
    window.localStorage.setItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION, APP_VERSION);

    let resolveFetch: ((value: Response) => void) | null = null;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve as (value: Response) => void;
        })
    );

    const { result } = renderHook(() => useUpdater({}));

    await waitFor(() => expect(result.current.postUpdateNotice?.stage).toBe("loading"));

    await act(async () => {
      result.current.dismissPostUpdateNotice();
    });

    expect(result.current.postUpdateNotice).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION)).toBeNull();

    await act(async () => {
      resolveFetch?.({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: `v${APP_VERSION}`,
          html_url: `https://github.com/byoungd/keep-up/releases/tag/v${APP_VERSION}`,
          body: "## Notes",
        }),
      } as Response);
      await Promise.resolve();
    });

    expect(result.current.postUpdateNotice).toBeNull();
  });

  it("clears stale post-update marker when version does not match current app", async () => {
    window.localStorage.setItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION, "0.0.1");

    renderHook(() => useUpdater({}));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY_PENDING_POST_UPDATE_VERSION)).toBeNull();
    });
  });
});
