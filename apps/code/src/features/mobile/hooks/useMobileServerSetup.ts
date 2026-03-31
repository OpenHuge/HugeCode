import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readRemoteServerProfilesState,
  setDefaultRemoteServerProfile,
  upsertRemoteServerProfile,
} from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { runBackendPoolOnboardingPreflight } from "../../../application/runtime/ports/remoteServers";
import { listWorkspaces } from "../../../application/runtime/ports/workspaceCatalog";
import type { AppSettings, RemoteBackendProfile, RemoteBackendProvider } from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import type { MobileServerSetupWizardProps } from "../components/MobileServerSetupWizard";

type UseMobileServerSetupParams = {
  appSettings: AppSettings;
  appSettingsLoading: boolean;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  refreshWorkspaces: () => Promise<unknown>;
};

type UseMobileServerSetupResult = {
  isMobileRuntime: boolean;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
  handleMobileConnectSuccess: () => Promise<void>;
};

function resolveDefaultRemoteProfile(settings: AppSettings): RemoteBackendProfile {
  const state = readRemoteServerProfilesState(settings);
  return (state.profiles.find((profile) => profile.id === state.defaultProfileId) ??
    state.profiles[0])!;
}

function isRemoteServerConfigured(settings: AppSettings): boolean {
  const defaultProfile = resolveDefaultRemoteProfile(settings);
  const tokenConfigured = Boolean(defaultProfile.token?.trim());
  if (!tokenConfigured) {
    return false;
  }
  if (defaultProfile.provider === "orbit") {
    return Boolean(defaultProfile.orbitWsUrl?.trim());
  }
  return Boolean(defaultProfile.host?.trim());
}

function defaultMobileSetupMessage(provider: RemoteBackendProvider): string {
  if (provider === "orbit") {
    return "Enter your Orbit websocket URL and token, then validate the connection.";
  }
  return "Enter your desktop Tailscale host and token, then validate the connection.";
}

function classifyMobileSetupError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalized = message.toLowerCase();
  if (!normalized) {
    return "Unable to reach remote backend.";
  }
  if (normalized.includes("auth") || normalized.includes("token") || normalized.includes("401")) {
    return "Authentication failed. Verify the token from your desktop setup and try again.";
  }
  if (normalized.includes("orbit websocket url is required") || normalized.includes("required")) {
    return message;
  }
  if (
    normalized.includes("connect") ||
    normalized.includes("reach") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  ) {
    return "Remote backend is unreachable. Check the host, desktop runtime, and network path.";
  }
  return message;
}

function buildDraftSettings(
  appSettings: AppSettings,
  options: {
    provider: RemoteBackendProvider;
    remoteHostDraft: string;
    remoteTokenDraft: string;
    orbitWsUrlDraft: string;
  }
): AppSettings {
  const currentDefaultProfile = resolveDefaultRemoteProfile(appSettings);
  const nextHost = options.remoteHostDraft.trim();
  const nextToken = options.remoteTokenDraft.trim() ? options.remoteTokenDraft.trim() : null;
  const nextOrbitWsUrl = options.orbitWsUrlDraft.trim() ? options.orbitWsUrlDraft.trim() : null;
  const nextProfile = {
    ...currentDefaultProfile,
    provider: options.provider,
    host: options.provider === "tcp" ? nextHost : null,
    token: nextToken,
    orbitWsUrl: options.provider === "orbit" ? nextOrbitWsUrl : null,
  } satisfies RemoteBackendProfile;
  return setDefaultRemoteServerProfile(
    upsertRemoteServerProfile(
      {
        ...appSettings,
        backendMode: "remote",
      },
      nextProfile
    ),
    nextProfile.id
  );
}

export function useMobileServerSetup({
  appSettings,
  appSettingsLoading,
  queueSaveSettings,
  refreshWorkspaces,
}: UseMobileServerSetupParams): UseMobileServerSetupResult {
  const isMobileRuntime = useMemo(() => isMobilePlatform(), []);
  const defaultRemoteProfile = useMemo(
    () => resolveDefaultRemoteProfile(appSettings),
    [appSettings]
  );

  const [providerDraft, setProviderDraft] = useState<RemoteBackendProvider>(
    defaultRemoteProfile.provider
  );
  const [remoteHostDraft, setRemoteHostDraft] = useState(defaultRemoteProfile.host ?? "");
  const [orbitWsUrlDraft, setOrbitWsUrlDraft] = useState(defaultRemoteProfile.orbitWsUrl ?? "");
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(defaultRemoteProfile.token ?? "");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [mobileServerReady, setMobileServerReady] = useState(!isMobileRuntime);
  const [validatedSettings, setValidatedSettings] = useState<AppSettings | null>(null);
  const [wizardDeferred, setWizardDeferred] = useState(false);

  useEffect(() => {
    if (!isMobileRuntime) {
      return;
    }
    setProviderDraft(defaultRemoteProfile.provider);
    setRemoteHostDraft(defaultRemoteProfile.host ?? "");
    setOrbitWsUrlDraft(defaultRemoteProfile.orbitWsUrl ?? "");
    setRemoteTokenDraft(defaultRemoteProfile.token ?? "");
    setValidatedSettings(null);
  }, [
    defaultRemoteProfile.host,
    defaultRemoteProfile.orbitWsUrl,
    defaultRemoteProfile.provider,
    defaultRemoteProfile.token,
    isMobileRuntime,
  ]);

  const runConnectivityCheck = useCallback(
    async (options?: { announceSuccess?: boolean }) => {
      if (!isMobileRuntime) {
        return true;
      }
      try {
        const entries = await listWorkspaces();
        try {
          await refreshWorkspaces();
        } catch {
          // Connectivity is confirmed by listWorkspaces; refresh is best-effort.
        }
        setStatusError(false);
        if (options?.announceSuccess) {
          const count = entries.length;
          const workspaceWord = count === 1 ? "workspace" : "workspaces";
          setStatusMessage(
            `Validated. ${count} ${workspaceWord} reachable on the remote backend. Save this connection to continue.`
          );
        } else {
          setStatusMessage(null);
        }
        return true;
      } catch (error) {
        const message = classifyMobileSetupError(error);
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(message);
        return false;
      }
    },
    [isMobileRuntime, refreshWorkspaces]
  );

  const handleProviderChange = useCallback((provider: RemoteBackendProvider) => {
    setValidatedSettings(null);
    setProviderDraft(provider);
  }, []);

  const handleRemoteHostChange = useCallback((value: string) => {
    setValidatedSettings(null);
    setRemoteHostDraft(value);
  }, []);

  const handleOrbitWsUrlChange = useCallback((value: string) => {
    setValidatedSettings(null);
    setOrbitWsUrlDraft(value);
  }, []);

  const handleRemoteTokenChange = useCallback((value: string) => {
    setValidatedSettings(null);
    setRemoteTokenDraft(value);
  }, []);

  const onConnectTest = useCallback(async () => {
    if (!isMobileRuntime || busy) {
      return;
    }

    const nextProvider = providerDraft;
    const nextHost = remoteHostDraft.trim();
    const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;
    const nextOrbitWsUrl = orbitWsUrlDraft.trim() ? orbitWsUrlDraft.trim() : null;
    const missingEndpoint = nextProvider === "orbit" ? !nextOrbitWsUrl : !nextHost.trim();

    if (missingEndpoint || !nextToken) {
      setValidatedSettings(null);
      setMobileServerReady(false);
      setStatusError(true);
      setStatusMessage(defaultMobileSetupMessage(nextProvider));
      return;
    }

    const draftSettings = buildDraftSettings(appSettings, {
      provider: nextProvider,
      remoteHostDraft,
      remoteTokenDraft,
      orbitWsUrlDraft,
    });
    setBusy(true);
    setStatusError(false);
    setStatusMessage(null);
    setValidatedSettings(null);
    try {
      const preflight = await runBackendPoolOnboardingPreflight({
        provider: nextProvider,
        remoteHost: nextProvider === "tcp" ? nextHost : null,
        remoteToken: nextToken,
        orbitWsUrl: nextOrbitWsUrl,
        backendClass: "primary",
        overlay: "tailscale",
      });
      if (!preflight.safeToPersist || !preflight.profilePatch) {
        const failureMessage =
          preflight.errors[0]?.summary ??
          preflight.checks.find((check) => check.status === "failed")?.summary ??
          "Unable to validate remote backend settings.";
        throw new Error(failureMessage);
      }
      const normalizedDraftSettings = buildDraftSettings(draftSettings, {
        provider: preflight.profilePatch.provider,
        remoteHostDraft: preflight.profilePatch.host ?? "",
        remoteTokenDraft: preflight.profilePatch.token ?? "",
        orbitWsUrlDraft: preflight.profilePatch.orbitWsUrl ?? "",
      });
      setValidatedSettings(normalizedDraftSettings);
      setStatusMessage("Validated. Save this connection to continue.");
      setMobileServerReady(false);
      setStatusError(false);
      setWizardDeferred(false);
    } catch (error) {
      setMobileServerReady(false);
      setStatusError(true);
      setStatusMessage(classifyMobileSetupError(error));
    } finally {
      setBusy(false);
    }
  }, [
    appSettings,
    busy,
    isMobileRuntime,
    orbitWsUrlDraft,
    providerDraft,
    remoteHostDraft,
    remoteTokenDraft,
  ]);

  const onSaveConnection = useCallback(async () => {
    if (!isMobileRuntime || busy || !validatedSettings) {
      return;
    }
    setBusy(true);
    setStatusError(false);
    try {
      await queueSaveSettings(validatedSettings);
      setWizardDeferred(false);
      setMobileServerReady(true);
      setStatusMessage(
        "Connection saved. Mobile control plane is now linked to your desktop backend."
      );
      await refreshWorkspaces();
    } catch (error) {
      setMobileServerReady(false);
      setStatusError(true);
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to save validated remote backend settings."
      );
    } finally {
      setBusy(false);
    }
  }, [busy, isMobileRuntime, queueSaveSettings, refreshWorkspaces, validatedSettings]);

  const onContinueLimitedMode = useCallback(() => {
    if (!isMobileRuntime) {
      return;
    }
    setWizardDeferred(true);
    setStatusError(false);
    setStatusMessage(
      "Limited mode enabled. Review and settings remain available, but runtime-backed work needs a validated desktop connection."
    );
  }, [isMobileRuntime]);

  useEffect(() => {
    if (!isMobileRuntime || appSettingsLoading || busy) {
      return;
    }
    if (validatedSettings) {
      setChecking(false);
      return;
    }
    if (!isRemoteServerConfigured(appSettings)) {
      setMobileServerReady(false);
      setChecking(false);
      setStatusError(true);
      setStatusMessage(defaultMobileSetupMessage(defaultRemoteProfile.provider));
      return;
    }

    let active = true;
    setChecking(true);

    void (async () => {
      const ok = await runConnectivityCheck();
      if (active && !ok) {
        setStatusMessage((previous) => previous ?? "Unable to connect to remote backend.");
      }
      if (active) {
        setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    appSettingsLoading,
    busy,
    defaultRemoteProfile.provider,
    isMobileRuntime,
    runConnectivityCheck,
    validatedSettings,
  ]);

  const handleMobileConnectSuccess = useCallback(async () => {
    if (!isMobileRuntime) {
      return;
    }
    setStatusError(false);
    setStatusMessage(null);
    setMobileServerReady(true);
    setWizardDeferred(false);
    try {
      await refreshWorkspaces();
    } catch {
      // Keep successful connectivity result even if local refresh fails.
    }
  }, [isMobileRuntime, refreshWorkspaces]);

  return {
    isMobileRuntime,
    showMobileSetupWizard:
      isMobileRuntime && !appSettingsLoading && !mobileServerReady && !wizardDeferred,
    mobileSetupWizardProps: {
      provider: providerDraft,
      remoteHostDraft,
      orbitWsUrlDraft,
      remoteTokenDraft,
      busy,
      checking,
      statusMessage,
      statusError,
      canSaveValidatedConnection: validatedSettings !== null,
      onProviderChange: handleProviderChange,
      onRemoteHostChange: handleRemoteHostChange,
      onOrbitWsUrlChange: handleOrbitWsUrlChange,
      onRemoteTokenChange: handleRemoteTokenChange,
      onConnectTest,
      onSaveConnection,
      onContinueLimitedMode,
    },
    handleMobileConnectSuccess,
  };
}
