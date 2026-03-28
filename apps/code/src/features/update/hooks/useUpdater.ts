import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkForDesktopUpdates,
  detectDesktopRuntimeHost,
  resolveDesktopUpdaterState,
  restartDesktopUpdate,
  subscribeToDesktopUpdateState,
} from "../../../application/runtime/facades/desktopHostFacade";
import type { DesktopUpdateState } from "../../../application/runtime/ports/desktopHostBridge";
import { relaunch } from "../../../application/runtime/ports/desktopProcess";
import {
  check,
  type DownloadEvent,
  type Update,
} from "../../../application/runtime/ports/desktopUpdater";
import type { DebugEntry } from "../../../types";
import {
  buildReleaseTagUrl,
  clearPendingPostUpdateVersion,
  fetchReleaseNotesForVersion,
  loadPendingPostUpdateVersion,
  normalizeReleaseVersion,
  savePendingPostUpdateVersion,
} from "../utils/postUpdateRelease";

type UpdateStage =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "manual"
  | "restarting"
  | "latest"
  | "error";

type UpdateProgress = {
  totalBytes?: number;
  downloadedBytes: number;
};

export type UpdateState = {
  message?: string;
  releaseUrl?: string;
  stage: UpdateStage;
  version?: string;
  progress?: UpdateProgress;
  error?: string;
};

type PostUpdateNotice =
  | {
      stage: "loading";
      version: string;
      htmlUrl: string;
    }
  | {
      stage: "ready";
      version: string;
      body: string;
      htmlUrl: string;
    }
  | {
      stage: "fallback";
      version: string;
      htmlUrl: string;
    };

export type PostUpdateNoticeState = PostUpdateNotice | null;

type UseUpdaterOptions = {
  enabled?: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

export function shouldSurfaceInitialElectronUpdaterState(updateState: DesktopUpdateState) {
  return (
    updateState.capability !== "automatic" &&
    (updateState.mode === "disabled_first_run_lock" || updateState.mode === "misconfigured")
  );
}

export function mapDesktopUpdateStateToUiState(
  updateState: DesktopUpdateState,
  options?: { announceNoUpdate?: boolean }
): UpdateState {
  if (updateState.capability !== "automatic") {
    if (options?.announceNoUpdate) {
      return {
        message: updateState.message ?? "Automatic desktop updates are unavailable for this build.",
        releaseUrl: updateState.releaseUrl ?? undefined,
        stage: "manual",
        version: updateState.version ?? undefined,
      };
    }

    return { stage: "idle", version: updateState.version ?? undefined };
  }

  switch (updateState.stage) {
    case "checking":
      return { stage: "checking", version: updateState.version ?? undefined };
    case "available":
      return { stage: "available", version: updateState.version ?? undefined };
    case "downloading":
      return {
        stage: "downloading",
        progress: {
          downloadedBytes: updateState.downloadedBytes ?? 0,
          totalBytes: updateState.totalBytes,
        },
        version: updateState.version ?? undefined,
      };
    case "downloaded":
      return { stage: "downloaded", version: updateState.version ?? undefined };
    case "latest":
      return { stage: options?.announceNoUpdate ? "latest" : "idle" };
    case "error":
      return {
        error: updateState.error ?? "Unable to check for updates.",
        releaseUrl: updateState.releaseUrl ?? undefined,
        stage: "error",
        version: updateState.version ?? undefined,
      };
    case "idle":
    default:
      return { stage: "idle", version: updateState.version ?? undefined };
  }
}

function isUpdaterUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    (normalized.includes("updater") &&
      (normalized.includes("not allowed") ||
        normalized.includes("not found") ||
        normalized.includes("not available") ||
        normalized.includes("plugin"))) ||
    (normalized.includes("process") &&
      (normalized.includes("not allowed") || normalized.includes("plugin")))
  );
}

export function resolveInitialUpdaterStartupAction(input: {
  desktopState: DesktopUpdateState;
  runtimeHost: "browser" | "electron";
}): {
  nextState: UpdateState | null;
  shouldAutoCheck: boolean;
} {
  if (input.runtimeHost !== "electron") {
    return {
      nextState: null,
      shouldAutoCheck: false,
    };
  }

  if (shouldSurfaceInitialElectronUpdaterState(input.desktopState)) {
    return {
      nextState: mapDesktopUpdateStateToUiState(input.desktopState, { announceNoUpdate: true }),
      shouldAutoCheck: false,
    };
  }

  return {
    nextState: null,
    shouldAutoCheck: input.desktopState.capability === "automatic",
  };
}

export function useUpdater({ enabled = true, onDebug }: UseUpdaterOptions) {
  const [state, setState] = useState<UpdateState>({ stage: "idle" });
  const [postUpdateNotice, setPostUpdateNotice] = useState<PostUpdateNoticeState>(null);
  const desktopUpdatePollGenerationRef = useRef(0);
  const updateRef = useRef<Update | null>(null);
  const postUpdateFetchGenerationRef = useRef(0);
  const latestTimeoutRef = useRef<number | null>(null);
  const latestToastDurationMs = 2000;

  const clearLatestTimeout = useCallback(() => {
    if (latestTimeoutRef.current !== null) {
      window.clearTimeout(latestTimeoutRef.current);
      latestTimeoutRef.current = null;
    }
  }, []);

  const syncDesktopUpdateState = useCallback(
    async (options?: { announceNoUpdate?: boolean; pollUntilSettled?: boolean }) => {
      const nextState = await resolveDesktopUpdaterState();
      setState(mapDesktopUpdateStateToUiState(nextState, options));

      if (options?.pollUntilSettled !== true) {
        return nextState;
      }

      if (nextState.stage !== "checking" && nextState.stage !== "downloading") {
        return nextState;
      }

      const generation = desktopUpdatePollGenerationRef.current + 1;
      desktopUpdatePollGenerationRef.current = generation;

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 250);
        });

        if (desktopUpdatePollGenerationRef.current !== generation) {
          return nextState;
        }

        const polledState = await resolveDesktopUpdaterState();
        setState(mapDesktopUpdateStateToUiState(polledState, options));
        if (polledState.stage !== "checking" && polledState.stage !== "downloading") {
          return polledState;
        }
      }

      return nextState;
    },
    []
  );

  const resetToIdle = useCallback(async () => {
    clearLatestTimeout();
    desktopUpdatePollGenerationRef.current += 1;
    const update = updateRef.current;
    updateRef.current = null;
    setState({ stage: "idle" });
    await update?.close();
  }, [clearLatestTimeout]);

  const checkForUpdates = useCallback(
    async (options?: { announceNoUpdate?: boolean }) => {
      if (!enabled) {
        return;
      }
      const runtimeHost = await detectDesktopRuntimeHost();
      if (runtimeHost === "electron") {
        clearLatestTimeout();
        const checkedState = await checkForDesktopUpdates();
        setState(mapDesktopUpdateStateToUiState(checkedState, options));
        await syncDesktopUpdateState({
          announceNoUpdate: options?.announceNoUpdate,
          pollUntilSettled: true,
        });
        return;
      }

      let update: Awaited<ReturnType<typeof check>> | null = null;
      try {
        clearLatestTimeout();
        setState({ stage: "checking" });
        update = await check();
        if (!update) {
          if (options?.announceNoUpdate) {
            setState({ stage: "latest" });
            latestTimeoutRef.current = window.setTimeout(() => {
              latestTimeoutRef.current = null;
              setState({ stage: "idle" });
            }, latestToastDurationMs);
          } else {
            setState({ stage: "idle" });
          }
          return;
        }

        updateRef.current = update;
        setState({
          stage: "available",
          version: update.version,
        });
      } catch (error) {
        if (isUpdaterUnavailableError(error)) {
          setState({ stage: "idle" });
          return;
        }
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        onDebug?.({
          id: `${Date.now()}-client-updater-error`,
          timestamp: Date.now(),
          source: "error",
          label: "updater/error",
          payload: message,
        });
        setState({ stage: "error", error: message });
      } finally {
        if (!updateRef.current) {
          await update?.close();
        }
      }
    },
    [clearLatestTimeout, enabled, onDebug, syncDesktopUpdateState]
  );

  const startUpdate = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const runtimeHost = await detectDesktopRuntimeHost();
    if (runtimeHost === "electron") {
      const desktopState = await resolveDesktopUpdaterState();
      setState(mapDesktopUpdateStateToUiState(desktopState));
      if (desktopState.stage === "downloaded") {
        setState((prev) => ({
          ...prev,
          stage: "restarting",
        }));
        if (desktopState.version) {
          savePendingPostUpdateVersion(desktopState.version);
        }
        await restartDesktopUpdate();
        return;
      }

      await checkForUpdates();
      return;
    }

    const update = updateRef.current;
    if (!update) {
      await checkForUpdates();
      return;
    }

    setState((prev) => ({
      ...prev,
      stage: "downloading",
      progress: { totalBytes: undefined, downloadedBytes: 0 },
      error: undefined,
    }));

    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          setState((prev) => ({
            ...prev,
            progress: {
              totalBytes: event.data.contentLength,
              downloadedBytes: 0,
            },
          }));
          return;
        }

        if (event.event === "Progress") {
          setState((prev) => ({
            ...prev,
            progress: {
              totalBytes: prev.progress?.totalBytes,
              downloadedBytes: (prev.progress?.downloadedBytes ?? 0) + event.data.chunkLength,
            },
          }));
          return;
        }

        if (event.event === "Finished") {
          setState((prev) => ({
            ...prev,
            stage: "installing",
          }));
        }
      });

      setState((prev) => ({
        ...prev,
        stage: "restarting",
      }));
      savePendingPostUpdateVersion(update.version);
      await relaunch();
    } catch (error) {
      if (isUpdaterUnavailableError(error)) {
        await resetToIdle();
        return;
      }
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      onDebug?.({
        id: `${Date.now()}-client-updater-error`,
        timestamp: Date.now(),
        source: "error",
        label: "updater/error",
        payload: message,
      });
      setState((prev) => ({
        ...prev,
        stage: "error",
        error: message,
      }));
    }
  }, [checkForUpdates, enabled, onDebug, resetToIdle]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    const unsubscribe = subscribeToDesktopUpdateState((nextState) => {
      if (!active) {
        return;
      }

      clearLatestTimeout();
      setState(mapDesktopUpdateStateToUiState(nextState));
    });

    void resolveDesktopUpdaterState()
      .then((nextState) => {
        if (!active) {
          return;
        }

        setState((currentState) =>
          currentState.stage === "idle" ? mapDesktopUpdateStateToUiState(nextState) : currentState
        );
      })
      .catch(() => {
        // Ignore: desktop updater state is optional outside Electron.
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [clearLatestTimeout, enabled]);

  useEffect(() => {
    if (!enabled || import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    void detectDesktopRuntimeHost().then((runtimeHost) => {
      if (cancelled) {
        return;
      }

      if (runtimeHost !== "electron" && runtimeHost !== "browser") {
        return;
      }

      if (runtimeHost === "electron") {
        void resolveDesktopUpdaterState().then((desktopState) => {
          if (cancelled) {
            return;
          }

          const startupAction = resolveInitialUpdaterStartupAction({
            desktopState,
            runtimeHost,
          });

          if (startupAction.nextState) {
            setState(startupAction.nextState);
          }

          if (!startupAction.shouldAutoCheck) {
            return;
          }

          void checkForUpdates();
        });
        return;
      }

      void checkForUpdates();
    });

    return () => {
      cancelled = true;
    };
  }, [checkForUpdates, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    void detectDesktopRuntimeHost().then((runtimeHost) => {
      if (cancelled) {
        return;
      }

      if (runtimeHost !== "electron" && runtimeHost !== "browser") {
        return;
      }

      const pendingVersion = loadPendingPostUpdateVersion();
      if (!pendingVersion) {
        return;
      }

      const normalizedPendingVersion = normalizeReleaseVersion(pendingVersion);
      const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
      const normalizedCurrentVersion = normalizeReleaseVersion(appVersion);
      if (!normalizedPendingVersion || normalizedPendingVersion !== normalizedCurrentVersion) {
        clearPendingPostUpdateVersion();
        return;
      }

      const fallbackUrl = buildReleaseTagUrl(normalizedPendingVersion);
      const generation = postUpdateFetchGenerationRef.current + 1;
      postUpdateFetchGenerationRef.current = generation;
      setPostUpdateNotice({
        stage: "loading",
        version: normalizedPendingVersion,
        htmlUrl: fallbackUrl,
      });

      void fetchReleaseNotesForVersion(normalizedPendingVersion)
        .then((releaseInfo) => {
          if (cancelled || postUpdateFetchGenerationRef.current !== generation) {
            return;
          }
          if (releaseInfo.body) {
            setPostUpdateNotice({
              stage: "ready",
              version: normalizedPendingVersion,
              body: releaseInfo.body,
              htmlUrl: releaseInfo.htmlUrl,
            });
            return;
          }
          setPostUpdateNotice({
            stage: "fallback",
            version: normalizedPendingVersion,
            htmlUrl: releaseInfo.htmlUrl,
          });
        })
        .catch((error) => {
          if (cancelled || postUpdateFetchGenerationRef.current !== generation) {
            return;
          }
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          onDebug?.({
            id: `${Date.now()}-client-updater-release-notes-error`,
            timestamp: Date.now(),
            source: "error",
            label: "updater/release-notes-error",
            payload: message,
          });
          setPostUpdateNotice({
            stage: "fallback",
            version: normalizedPendingVersion,
            htmlUrl: fallbackUrl,
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, onDebug]);

  useEffect(() => {
    return () => {
      clearLatestTimeout();
    };
  }, [clearLatestTimeout]);

  const dismissPostUpdateNotice = useCallback(() => {
    postUpdateFetchGenerationRef.current += 1;
    clearPendingPostUpdateVersion();
    setPostUpdateNotice(null);
  }, []);

  return {
    state,
    startUpdate,
    checkForUpdates,
    dismiss: resetToIdle,
    postUpdateNotice,
    dismissPostUpdateNotice,
  };
}
