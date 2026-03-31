import { useCallback, useEffect, useState } from "react";
import {
  netbirdDaemonCommandPreview as fetchNetbirdDaemonCommandPreview,
  netbirdStatus as fetchNetbirdStatus,
  runBackendPoolOnboardingPreflight,
  tailscaleDaemonCommandPreview as fetchTailscaleDaemonCommandPreview,
  tailscaleDaemonStart,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus as fetchTailscaleStatus,
} from "../ports/remoteServers";
import { listWorkspaces } from "../ports/workspaceCatalog";
import type { RemoteBackendProvider, RemoteTcpOverlay } from "../../../types";
import {
  DEFAULT_REMOTE_HOST,
  delay,
  formatErrorMessage,
  formatOnboardingPreflightFailure,
  getOrbitStatusText,
  normalizeOverrideValue,
  ORBIT_DEFAULT_POLL_INTERVAL_SECONDS,
  ORBIT_MAX_INLINE_POLL_SECONDS,
  type PersistRemoteProfile,
  type RuntimeOperationsOrbitActionResult,
  type RuntimeOperationsOrbitClient,
} from "./runtimeOperationsShared";

type UseRuntimeOverlayConnectivityFacadeOptions = {
  activeSection: string;
  mobilePlatform: boolean;
  remoteProvider: RemoteBackendProvider;
  activeTcpOverlay?: RemoteTcpOverlay | null;
  remoteHostDraft: string;
  remoteTokenDraft: string;
  orbitWsUrlDraft: string;
  onPersistRemoteProfile: PersistRemoteProfile;
  onMobileConnectSuccess?: () => Promise<void> | void;
  orbitServiceClient: RuntimeOperationsOrbitClient;
};

export function useRuntimeOverlayConnectivityFacade({
  activeSection,
  mobilePlatform,
  remoteProvider,
  activeTcpOverlay = "tailscale",
  remoteHostDraft,
  remoteTokenDraft,
  orbitWsUrlDraft,
  onPersistRemoteProfile,
  onMobileConnectSuccess,
  orbitServiceClient,
}: UseRuntimeOverlayConnectivityFacadeOptions) {
  const [orbitStatusText, setOrbitStatusText] = useState<string | null>(null);
  const [orbitAuthCode, setOrbitAuthCode] = useState<string | null>(null);
  const [orbitVerificationUrl, setOrbitVerificationUrl] = useState<string | null>(null);
  const [orbitBusyAction, setOrbitBusyAction] = useState<string | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<Awaited<
    ReturnType<typeof fetchTailscaleStatus>
  > | null>(null);
  const [tailscaleStatusBusy, setTailscaleStatusBusy] = useState(false);
  const [tailscaleStatusError, setTailscaleStatusError] = useState<string | null>(null);
  const [tailscaleCommandPreview, setTailscaleCommandPreview] = useState<Awaited<
    ReturnType<typeof fetchTailscaleDaemonCommandPreview>
  > | null>(null);
  const [tailscaleCommandBusy, setTailscaleCommandBusy] = useState(false);
  const [tailscaleCommandError, setTailscaleCommandError] = useState<string | null>(null);
  const [netbirdStatus, setNetbirdStatus] = useState<Awaited<
    ReturnType<typeof fetchNetbirdStatus>
  > | null>(null);
  const [netbirdStatusBusy, setNetbirdStatusBusy] = useState(false);
  const [netbirdStatusError, setNetbirdStatusError] = useState<string | null>(null);
  const [netbirdCommandPreview, setNetbirdCommandPreview] = useState<Awaited<
    ReturnType<typeof fetchNetbirdDaemonCommandPreview>
  > | null>(null);
  const [netbirdCommandBusy, setNetbirdCommandBusy] = useState(false);
  const [netbirdCommandError, setNetbirdCommandError] = useState<string | null>(null);
  const [tcpDaemonStatus, setTcpDaemonStatus] = useState<Awaited<
    ReturnType<typeof tailscaleDaemonStatus>
  > | null>(null);
  const [tcpDaemonBusyAction, setTcpDaemonBusyAction] = useState<
    "start" | "stop" | "status" | null
  >(null);
  const [mobileConnectBusy, setMobileConnectBusy] = useState(false);
  const [mobileConnectStatusText, setMobileConnectStatusText] = useState<string | null>(null);
  const [mobileConnectStatusError, setMobileConnectStatusError] = useState(false);

  const handleRefreshTailscaleStatus = useCallback(async () => {
    setTailscaleStatusBusy(true);
    setTailscaleStatusError(null);
    try {
      setTailscaleStatus(await fetchTailscaleStatus());
    } catch (error) {
      setTailscaleStatusError(formatErrorMessage(error, "Unable to load Tailscale status."));
    } finally {
      setTailscaleStatusBusy(false);
    }
  }, []);

  const handleRefreshTailscaleCommandPreview = useCallback(async () => {
    setTailscaleCommandBusy(true);
    setTailscaleCommandError(null);
    try {
      setTailscaleCommandPreview(await fetchTailscaleDaemonCommandPreview());
    } catch (error) {
      setTailscaleCommandError(
        formatErrorMessage(error, "Unable to build Tailscale daemon command.")
      );
    } finally {
      setTailscaleCommandBusy(false);
    }
  }, []);

  const handleRefreshNetbirdStatus = useCallback(async () => {
    setNetbirdStatusBusy(true);
    setNetbirdStatusError(null);
    try {
      setNetbirdStatus(await fetchNetbirdStatus());
    } catch (error) {
      setNetbirdStatusError(formatErrorMessage(error, "Unable to load NetBird status."));
    } finally {
      setNetbirdStatusBusy(false);
    }
  }, []);

  const handleRefreshNetbirdCommandPreview = useCallback(async () => {
    setNetbirdCommandBusy(true);
    setNetbirdCommandError(null);
    try {
      setNetbirdCommandPreview(await fetchNetbirdDaemonCommandPreview());
    } catch (error) {
      setNetbirdCommandError(formatErrorMessage(error, "Unable to build NetBird setup command."));
    } finally {
      setNetbirdCommandBusy(false);
    }
  }, []);

  const runTcpDaemonAction = useCallback(
    async (
      action: "start" | "stop" | "status",
      run: () => Promise<Awaited<ReturnType<typeof tailscaleDaemonStatus>>>
    ) => {
      setTcpDaemonBusyAction(action);
      try {
        setTcpDaemonStatus(await run());
      } catch (error) {
        const errorMessage = formatErrorMessage(
          error,
          "Unable to update mobile access daemon status."
        );
        setTcpDaemonStatus((prev) => ({
          state: "error",
          pid: null,
          startedAtMs: null,
          lastError: errorMessage,
          listenAddr: prev?.listenAddr ?? null,
        }));
      } finally {
        setTcpDaemonBusyAction(null);
      }
    },
    []
  );

  const handleTcpDaemonStart = useCallback(async () => {
    await runTcpDaemonAction("start", tailscaleDaemonStart);
  }, [runTcpDaemonAction]);

  const handleTcpDaemonStop = useCallback(async () => {
    await runTcpDaemonAction("stop", tailscaleDaemonStop);
  }, [runTcpDaemonAction]);

  const handleTcpDaemonStatus = useCallback(async () => {
    await runTcpDaemonAction("status", tailscaleDaemonStatus);
  }, [runTcpDaemonAction]);

  const runOrbitAction = useCallback(
    async <T extends RuntimeOperationsOrbitActionResult>(
      actionKey: string,
      actionLabel: string,
      action: () => Promise<T>,
      successFallback: string
    ): Promise<T | null> => {
      setOrbitBusyAction(actionKey);
      setOrbitStatusText(`${actionLabel}...`);
      try {
        const result = await action();
        setOrbitStatusText(getOrbitStatusText(result, successFallback));
        return result;
      } catch (error) {
        setOrbitStatusText(
          `${actionLabel} failed: ${formatErrorMessage(error, "Unknown Orbit error")}`
        );
        return null;
      } finally {
        setOrbitBusyAction(null);
      }
    },
    []
  );

  const syncRemoteBackendToken = useCallback(
    async (nextToken: string | null) => {
      const normalizedToken = nextToken?.trim() ? nextToken.trim() : null;
      await onPersistRemoteProfile({ token: normalizedToken });
    },
    [onPersistRemoteProfile]
  );

  const handleOrbitConnectTest = useCallback(async () => {
    await runOrbitAction(
      "connect-test",
      "Connect test",
      orbitServiceClient.orbitConnectTest,
      "Orbit connection test succeeded."
    );
  }, [orbitServiceClient.orbitConnectTest, runOrbitAction]);

  const handleOrbitSignIn = useCallback(async () => {
    setOrbitBusyAction("sign-in");
    setOrbitStatusText("Starting Orbit sign in...");
    setOrbitAuthCode(null);
    setOrbitVerificationUrl(null);
    try {
      const startResult = await orbitServiceClient.orbitSignInStart();
      setOrbitAuthCode(startResult.userCode ?? startResult.deviceCode);
      setOrbitVerificationUrl(startResult.verificationUriComplete ?? startResult.verificationUri);
      setOrbitStatusText(
        "Orbit sign in started. Finish authorization in the browser window, then keep this dialog open while we poll for completion."
      );

      const maxPollWindowSeconds = Math.max(
        1,
        Math.min(startResult.expiresInSeconds, ORBIT_MAX_INLINE_POLL_SECONDS)
      );
      const deadlineMs = Date.now() + maxPollWindowSeconds * 1000;
      let pollIntervalSeconds = Math.max(
        1,
        startResult.intervalSeconds || ORBIT_DEFAULT_POLL_INTERVAL_SECONDS
      );

      while (Date.now() < deadlineMs) {
        await delay(pollIntervalSeconds * 1000);
        const pollResult = await orbitServiceClient.orbitSignInPoll(startResult.deviceCode);
        setOrbitStatusText(getOrbitStatusText(pollResult, "Orbit sign in status refreshed."));

        if (pollResult.status === "pending") {
          if (typeof pollResult.intervalSeconds === "number") {
            pollIntervalSeconds = Math.max(1, pollResult.intervalSeconds);
          }
          continue;
        }

        if (pollResult.status === "authorized" && pollResult.token) {
          await syncRemoteBackendToken(pollResult.token);
        }
        return;
      }

      setOrbitStatusText(
        "Orbit sign in is still pending. Leave this window open and try Sign In again if authorization just completed."
      );
    } catch (error) {
      setOrbitStatusText(`Sign In failed: ${formatErrorMessage(error, "Unknown Orbit error")}`);
    } finally {
      setOrbitBusyAction(null);
    }
  }, [orbitServiceClient, syncRemoteBackendToken]);

  const handleOrbitSignOut = useCallback(async () => {
    const result = await runOrbitAction(
      "sign-out",
      "Sign Out",
      orbitServiceClient.orbitSignOut,
      "Signed out from Orbit."
    );
    if (result !== null) {
      try {
        await syncRemoteBackendToken(null);
        setOrbitAuthCode(null);
        setOrbitVerificationUrl(null);
      } catch (error) {
        setOrbitStatusText(`Sign Out failed: ${formatErrorMessage(error, "Unknown Orbit error")}`);
      }
    }
  }, [orbitServiceClient.orbitSignOut, runOrbitAction, syncRemoteBackendToken]);

  const handleOrbitRunnerStart = useCallback(async () => {
    await runOrbitAction(
      "runner-start",
      "Start Runner",
      orbitServiceClient.orbitRunnerStart,
      "Orbit runner started."
    );
  }, [orbitServiceClient.orbitRunnerStart, runOrbitAction]);

  const handleOrbitRunnerStop = useCallback(async () => {
    await runOrbitAction(
      "runner-stop",
      "Stop Runner",
      orbitServiceClient.orbitRunnerStop,
      "Orbit runner stopped."
    );
  }, [orbitServiceClient.orbitRunnerStop, runOrbitAction]);

  const handleOrbitRunnerStatus = useCallback(async () => {
    await runOrbitAction(
      "runner-status",
      "Refresh Status",
      orbitServiceClient.orbitRunnerStatus,
      "Orbit runner status refreshed."
    );
  }, [orbitServiceClient.orbitRunnerStatus, runOrbitAction]);

  useEffect(() => {
    if (activeSection !== "server" || remoteProvider !== "tcp") {
      return;
    }
    if (!mobilePlatform) {
      if (activeTcpOverlay === "netbird") {
        void handleRefreshNetbirdCommandPreview();
      } else {
        void handleRefreshTailscaleCommandPreview();
      }
      void handleTcpDaemonStatus();
    }
    if (activeTcpOverlay === "netbird") {
      if (netbirdStatus === null && !netbirdStatusBusy && !netbirdStatusError) {
        void handleRefreshNetbirdStatus();
      }
      return;
    }
    if (tailscaleStatus === null && !tailscaleStatusBusy && !tailscaleStatusError) {
      void handleRefreshTailscaleStatus();
    }
  }, [
    activeSection,
    activeTcpOverlay,
    handleRefreshNetbirdCommandPreview,
    handleRefreshNetbirdStatus,
    handleRefreshTailscaleCommandPreview,
    handleRefreshTailscaleStatus,
    handleTcpDaemonStatus,
    mobilePlatform,
    netbirdStatus,
    netbirdStatusBusy,
    netbirdStatusError,
    remoteProvider,
    tailscaleStatus,
    tailscaleStatusBusy,
    tailscaleStatusError,
  ]);

  const handleMobileConnectTest = useCallback(
    async (overrides?: {
      provider?: RemoteBackendProvider;
      remoteHostDraft?: string;
      remoteTokenDraft?: string;
      orbitWsUrlDraft?: string;
    }) => {
      const provider = overrides?.provider ?? remoteProvider;
      const nextRemoteHostDraft = overrides?.remoteHostDraft ?? remoteHostDraft;
      const nextRemoteTokenDraft = overrides?.remoteTokenDraft ?? remoteTokenDraft;
      const nextOrbitWsUrlDraft = overrides?.orbitWsUrlDraft ?? orbitWsUrlDraft;

      setMobileConnectBusy(true);
      setMobileConnectStatusText(null);
      setMobileConnectStatusError(false);
      try {
        const preflight = await runBackendPoolOnboardingPreflight({
          provider,
          remoteHost: provider === "tcp" ? nextRemoteHostDraft.trim() || DEFAULT_REMOTE_HOST : null,
          remoteToken: nextRemoteTokenDraft.trim() ? nextRemoteTokenDraft.trim() : null,
          orbitWsUrl: normalizeOverrideValue(nextOrbitWsUrlDraft),
          backendClass: "primary",
          overlay: activeTcpOverlay ?? "tailscale",
        });
        if (!preflight.safeToPersist || !preflight.profilePatch) {
          throw new Error(
            formatOnboardingPreflightFailure(
              preflight,
              "Remote backend preflight failed before settings were saved."
            )
          );
        }
        await onPersistRemoteProfile({
          provider: preflight.profilePatch.provider,
          host: preflight.profilePatch.host ?? undefined,
          token: preflight.profilePatch.token ?? undefined,
          orbitWsUrl: preflight.profilePatch.orbitWsUrl ?? undefined,
          tcpOverlay: preflight.profilePatch.tcpOverlay ?? undefined,
        });
        const workspaces = await listWorkspaces();
        const workspaceCount = workspaces.length;
        const workspaceWord = workspaceCount === 1 ? "workspace" : "workspaces";
        setMobileConnectStatusText(
          `Connected. ${workspaceCount} ${workspaceWord} reachable on the remote backend.`
        );
        await onMobileConnectSuccess?.();
      } catch (error) {
        setMobileConnectStatusError(true);
        setMobileConnectStatusText(
          formatErrorMessage(error, "Unable to connect to remote backend.")
        );
      } finally {
        setMobileConnectBusy(false);
      }
    },
    [
      activeTcpOverlay,
      onMobileConnectSuccess,
      onPersistRemoteProfile,
      orbitWsUrlDraft,
      remoteHostDraft,
      remoteProvider,
      remoteTokenDraft,
    ]
  );

  useEffect(() => {
    if (!mobilePlatform) {
      return;
    }
    setMobileConnectStatusText(null);
    setMobileConnectStatusError(false);
  }, [mobilePlatform, orbitWsUrlDraft, remoteHostDraft, remoteProvider, remoteTokenDraft]);

  return {
    orbitStatusText,
    orbitAuthCode,
    orbitVerificationUrl,
    orbitBusyAction,
    tailscaleStatus,
    tailscaleStatusBusy,
    tailscaleStatusError,
    tailscaleCommandPreview,
    tailscaleCommandBusy,
    tailscaleCommandError,
    netbirdStatus,
    netbirdStatusBusy,
    netbirdStatusError,
    netbirdCommandPreview,
    netbirdCommandBusy,
    netbirdCommandError,
    tcpDaemonStatus,
    tcpDaemonBusyAction,
    mobileConnectBusy,
    mobileConnectStatusText,
    mobileConnectStatusError,
    handleRefreshTailscaleStatus,
    handleRefreshTailscaleCommandPreview,
    handleRefreshNetbirdStatus,
    handleRefreshNetbirdCommandPreview,
    handleTcpDaemonStart,
    handleTcpDaemonStop,
    handleTcpDaemonStatus,
    handleOrbitConnectTest,
    handleOrbitSignIn,
    handleOrbitSignOut,
    handleOrbitRunnerStart,
    handleOrbitRunnerStop,
    handleOrbitRunnerStatus,
    handleMobileConnectTest,
  };
}
