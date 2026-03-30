import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRuntimeAutomationSchedulesFacade } from "../../../application/runtime/facades/runtimeAutomationSchedulesFacade";
import { useRuntimeBackendPoolFacade } from "../../../application/runtime/facades/runtimeBackendPoolFacade";
import { useRuntimeOverlayConnectivityFacade } from "../../../application/runtime/facades/runtimeOverlayConnectivityFacade";
import {
  createRemoteServerProfileDraft,
  readRemoteServerProfilesState,
  removeRemoteServerProfile,
  setDefaultRemoteExecutionBackend,
  setDefaultRemoteServerProfile,
  upsertRemoteServerProfile,
} from "../../../application/runtime/facades/runtimeRemoteServerProfilesFacade";
import { pushErrorToast } from "../../../application/runtime/ports/toasts";
import type {
  AppSettings,
  RemoteBackendProfile,
  RemoteBackendProvider,
  RemoteTcpOverlay,
} from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import type { CodexSection, OrbitServiceClient } from "../components/settingsTypes";
import { DEFAULT_REMOTE_HOST } from "../components/settingsViewConstants";
import { formatErrorMessage, normalizeOverrideValue } from "../components/settingsViewHelpers";
import {
  createEmptyAcpBackendFormState,
  mapAcpFormStateToUpsertInput,
  mapAcpIntegrationToFormState,
  type AcpBackendFormMode,
  type AcpBackendFormState,
} from "../components/sections/settings-backend-pool/acpBackendForm";
import {
  createEmptyNativeBackendFormState,
  mapNativeBackendToFormState,
  mapNativeFormStateToUpsertInput,
  type NativeBackendFormMode,
  type NativeBackendFormState,
} from "../components/sections/settings-backend-pool/nativeBackendForm";
import type {
  SettingsAutomationScheduleAction,
  SettingsAutomationScheduleDraft,
} from "../components/sections/SettingsAutomationSection";
import {
  buildNativeSchedulePayload,
  mapNativeScheduleToDraft,
  mapNativeScheduleToSummary,
  readScheduleText,
} from "./settingsAutomationSchedules";
import {
  createSettingsServerOperabilityState,
  type SettingsServerOperabilityState,
} from "../components/sections/settings-server-section/shared";

type UseSettingsServerStateOptions = {
  activeSection: CodexSection;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onMobileConnectSuccess?: () => Promise<void> | void;
  orbitServiceClient: OrbitServiceClient;
};

export function useSettingsServerState({
  activeSection,
  appSettings,
  onUpdateAppSettings,
  onMobileConnectSuccess,
  orbitServiceClient,
}: UseSettingsServerStateOptions) {
  const [selectedRemoteProfileId, setSelectedRemoteProfileId] = useState<string | null>(null);
  const [remoteProfileLabelDraft, setRemoteProfileLabelDraft] = useState("");
  const [remoteHostDraft, setRemoteHostDraft] = useState("");
  const [remoteTokenDraft, setRemoteTokenDraft] = useState("");
  const [gatewayHttpBaseUrlDraft, setGatewayHttpBaseUrlDraft] = useState("");
  const [gatewayWsBaseUrlDraft, setGatewayWsBaseUrlDraft] = useState("");
  const [gatewayTokenRefDraft, setGatewayTokenRefDraft] = useState("");
  const [gatewayHealthcheckPathDraft, setGatewayHealthcheckPathDraft] = useState("");
  const [orbitWsUrlDraft, setOrbitWsUrlDraft] = useState("");
  const [orbitAuthUrlDraft, setOrbitAuthUrlDraft] = useState("");
  const [orbitRunnerNameDraft, setOrbitRunnerNameDraft] = useState("");
  const [orbitAccessClientIdDraft, setOrbitAccessClientIdDraft] = useState("");
  const [orbitAccessClientSecretRefDraft, setOrbitAccessClientSecretRefDraft] = useState("");
  const [acpEditorOpen, setAcpEditorOpen] = useState(false);
  const [acpEditorMode, setAcpEditorMode] = useState<AcpBackendFormMode>("add");
  const [acpEditorDraft, setAcpEditorDraft] = useState<AcpBackendFormState>(
    createEmptyAcpBackendFormState()
  );
  const [acpEditorSourceIntegrationId, setAcpEditorSourceIntegrationId] = useState<string | null>(
    null
  );
  const [acpEditorSaving, setAcpEditorSaving] = useState(false);
  const [acpEditorProbeBusy, setAcpEditorProbeBusy] = useState(false);
  const [acpEditorError, setAcpEditorError] = useState<string | null>(null);
  const [nativeBackendEditorOpen, setNativeBackendEditorOpen] = useState(false);
  const [nativeBackendEditorMode, setNativeBackendEditorMode] =
    useState<NativeBackendFormMode>("add");
  const [nativeBackendEditorDraft, setNativeBackendEditorDraft] = useState<NativeBackendFormState>(
    createEmptyNativeBackendFormState()
  );
  const [nativeBackendEditorSaving, setNativeBackendEditorSaving] = useState(false);
  const [nativeBackendEditorError, setNativeBackendEditorError] = useState<string | null>(null);
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const latestSettingsRef = useRef(appSettings);
  const remoteProfilesState = useMemo(
    () => readRemoteServerProfilesState(appSettings, selectedRemoteProfileId),
    [appSettings, selectedRemoteProfileId]
  );
  const selectedRemoteProfile = useMemo(
    () =>
      remoteProfilesState.profiles.find(
        (profile) => profile.id === remoteProfilesState.selectedProfileId
      ) ?? null,
    [remoteProfilesState]
  );
  const resolvedRemoteProvider: RemoteBackendProvider =
    selectedRemoteProfile?.provider ?? remoteProfilesState.profiles[0]?.provider ?? "tcp";
  useEffect(() => {
    latestSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    if (selectedRemoteProfileId !== remoteProfilesState.selectedProfileId) {
      setSelectedRemoteProfileId(remoteProfilesState.selectedProfileId);
    }
  }, [remoteProfilesState.selectedProfileId, selectedRemoteProfileId]);

  useEffect(() => {
    setRemoteProfileLabelDraft(selectedRemoteProfile?.label ?? "");
    setRemoteHostDraft(selectedRemoteProfile?.host ?? "");
    setRemoteTokenDraft(selectedRemoteProfile?.token ?? "");
    setGatewayHttpBaseUrlDraft(selectedRemoteProfile?.gatewayConfig?.httpBaseUrl ?? "");
    setGatewayWsBaseUrlDraft(selectedRemoteProfile?.gatewayConfig?.wsBaseUrl ?? "");
    setGatewayTokenRefDraft(selectedRemoteProfile?.gatewayConfig?.tokenRef ?? "");
    setGatewayHealthcheckPathDraft(selectedRemoteProfile?.gatewayConfig?.healthcheckPath ?? "");
    setOrbitWsUrlDraft(selectedRemoteProfile?.orbitWsUrl ?? "");
    setOrbitAuthUrlDraft(selectedRemoteProfile?.orbitAuthUrl ?? "");
    setOrbitRunnerNameDraft(selectedRemoteProfile?.orbitRunnerName ?? "");
    setOrbitAccessClientIdDraft(selectedRemoteProfile?.orbitAccessClientId ?? "");
    setOrbitAccessClientSecretRefDraft(selectedRemoteProfile?.orbitAccessClientSecretRef ?? "");
  }, [
    selectedRemoteProfile?.host,
    selectedRemoteProfile?.gatewayConfig?.healthcheckPath,
    selectedRemoteProfile?.gatewayConfig?.httpBaseUrl,
    selectedRemoteProfile?.gatewayConfig?.tokenRef,
    selectedRemoteProfile?.gatewayConfig?.wsBaseUrl,
    selectedRemoteProfile?.id,
    selectedRemoteProfile?.label,
    selectedRemoteProfile?.orbitAccessClientId,
    selectedRemoteProfile?.orbitAccessClientSecretRef,
    selectedRemoteProfile?.orbitAuthUrl,
    selectedRemoteProfile?.orbitRunnerName,
    selectedRemoteProfile?.orbitWsUrl,
    selectedRemoteProfile?.token,
  ]);

  const persistRemoteSettings = useCallback(
    async (nextSettings: AppSettings) => {
      const normalizedNextSettings = mobilePlatform
        ? {
            ...nextSettings,
            backendMode: "remote" as const,
          }
        : nextSettings;
      await onUpdateAppSettings(normalizedNextSettings);
      latestSettingsRef.current = normalizedNextSettings;
      return normalizedNextSettings;
    },
    [mobilePlatform, onUpdateAppSettings]
  );

  const updateSelectedRemoteProfile = useCallback(
    async (patch: Partial<RemoteBackendProfile>) => {
      const currentState = readRemoteServerProfilesState(
        latestSettingsRef.current,
        selectedRemoteProfileId
      );
      const baseProfile =
        currentState.profiles.find((profile) => profile.id === currentState.selectedProfileId) ??
        createRemoteServerProfileDraft({ provider: "tcp" });
      const nextSettings = upsertRemoteServerProfile(latestSettingsRef.current, {
        ...baseProfile,
        ...patch,
      });
      const savedSettings = await persistRemoteSettings(nextSettings);
      const nextState = readRemoteServerProfilesState(savedSettings, baseProfile.id);
      setSelectedRemoteProfileId(nextState.selectedProfileId);
      return savedSettings;
    },
    [persistRemoteSettings, selectedRemoteProfileId]
  );

  const {
    backendPoolCapabilityEnabled,
    backendPoolSnapshot,
    backendPoolLoading,
    backendPoolError,
    backendPoolSectionReadOnlyReason,
    backendPoolStateActionsEnabled,
    backendPoolRemoveEnabled,
    backendPoolUpsertEnabled,
    backendPoolProbeEnabled,
    acpIntegrationsSnapshot,
    backendPoolBootstrapPreview,
    backendPoolBootstrapPreviewError,
    backendPoolDiagnostics,
    backendPoolDiagnosticsError,
    refreshBackendPool,
    handleBackendPoolAction,
    upsertRuntimeBackend,
    upsertAcpBackend,
    handleAcpBackendProbe,
  } = useRuntimeBackendPoolFacade({
    activeSection,
    remoteProvider: resolvedRemoteProvider,
  });
  const {
    automationSchedulesCapabilityEnabled,
    automationSchedulesSnapshot,
    automationSchedulesLoading,
    automationSchedulesError,
    automationSchedulesUnavailableReason,
    automationSchedulesReadOnlyReason,
    automationSchedulesCreateEnabled,
    automationSchedulesUpdateEnabled,
    automationSchedulesRunNowEnabled,
    automationSchedulesCancelRunEnabled,
    refreshAutomationSchedules,
    createAutomationSchedule,
    updateAutomationSchedule,
    runAutomationScheduleNow,
    cancelAutomationScheduleRun,
  } = useRuntimeAutomationSchedulesFacade({
    activeSection,
  });
  const {
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
    handleRefreshTailscaleStatus: refreshTailscaleStatus,
    handleRefreshTailscaleCommandPreview: refreshTailscaleCommandPreview,
    handleRefreshNetbirdStatus: refreshNetbirdStatus,
    handleRefreshNetbirdCommandPreview: refreshNetbirdCommandPreview,
    handleTcpDaemonStart,
    handleTcpDaemonStop,
    handleTcpDaemonStatus,
    handleOrbitConnectTest: runOrbitConnectTest,
    handleOrbitSignIn: runOrbitSignIn,
    handleOrbitSignOut: runOrbitSignOut,
    handleOrbitRunnerStart: runOrbitRunnerStart,
    handleOrbitRunnerStop: runOrbitRunnerStop,
    handleOrbitRunnerStatus: runOrbitRunnerStatus,
    handleMobileConnectTest: runMobileConnectTest,
  } = useRuntimeOverlayConnectivityFacade({
    activeSection,
    mobilePlatform,
    remoteProvider: resolvedRemoteProvider,
    activeTcpOverlay: selectedRemoteProfile?.tcpOverlay ?? "tailscale",
    remoteHostDraft,
    remoteTokenDraft,
    orbitWsUrlDraft,
    onPersistRemoteProfile: async (patch) => {
      await updateSelectedRemoteProfile(patch);
    },
    onMobileConnectSuccess,
    orbitServiceClient,
  });
  const acpEditorObservation = useMemo(
    () =>
      acpEditorSourceIntegrationId
        ? (acpIntegrationsSnapshot.find(
            (integration) => integration.integrationId === acpEditorSourceIntegrationId
          ) ?? null)
        : null,
    [acpEditorSourceIntegrationId, acpIntegrationsSnapshot]
  );

  const applyRemoteHost = useCallback(
    async (rawValue: string) => {
      const nextHost = rawValue.trim() || DEFAULT_REMOTE_HOST;
      setRemoteHostDraft(nextHost);
      await updateSelectedRemoteProfile({ host: nextHost, provider: "tcp" });
    },
    [updateSelectedRemoteProfile]
  );

  const handleCommitRemoteHost = useCallback(async () => {
    await applyRemoteHost(remoteHostDraft);
  }, [applyRemoteHost, remoteHostDraft]);

  const handleCommitRemoteToken = useCallback(async () => {
    const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;
    setRemoteTokenDraft(nextToken ?? "");
    await updateSelectedRemoteProfile({ token: nextToken });
  }, [remoteTokenDraft, updateSelectedRemoteProfile]);

  const updateGatewayConfig = useCallback(
    async (patch: Partial<NonNullable<RemoteBackendProfile["gatewayConfig"]>>) => {
      const currentGatewayConfig = selectedRemoteProfile?.gatewayConfig ?? null;
      await updateSelectedRemoteProfile({
        gatewayConfig: {
          ...(currentGatewayConfig ?? {}),
          ...patch,
        },
      });
    },
    [selectedRemoteProfile?.gatewayConfig, updateSelectedRemoteProfile]
  );

  const handleCommitGatewayHttpBaseUrl = useCallback(async () => {
    const nextValue = gatewayHttpBaseUrlDraft.trim() || null;
    setGatewayHttpBaseUrlDraft(nextValue ?? "");
    await updateGatewayConfig({ httpBaseUrl: nextValue });
  }, [gatewayHttpBaseUrlDraft, updateGatewayConfig]);

  const handleCommitGatewayWsBaseUrl = useCallback(async () => {
    const nextValue = gatewayWsBaseUrlDraft.trim() || null;
    setGatewayWsBaseUrlDraft(nextValue ?? "");
    await updateGatewayConfig({ wsBaseUrl: nextValue });
  }, [gatewayWsBaseUrlDraft, updateGatewayConfig]);

  const handleCommitGatewayTokenRef = useCallback(async () => {
    const nextValue = gatewayTokenRefDraft.trim() || null;
    setGatewayTokenRefDraft(nextValue ?? "");
    await updateGatewayConfig({ tokenRef: nextValue });
  }, [gatewayTokenRefDraft, updateGatewayConfig]);

  const handleCommitGatewayHealthcheckPath = useCallback(async () => {
    const rawValue = gatewayHealthcheckPathDraft.trim();
    const nextValue = rawValue ? (rawValue.startsWith("/") ? rawValue : `/${rawValue}`) : null;
    setGatewayHealthcheckPathDraft(nextValue ?? "");
    await updateGatewayConfig({ healthcheckPath: nextValue });
  }, [gatewayHealthcheckPathDraft, updateGatewayConfig]);

  const handleSetGatewayAuthMode = useCallback(
    async (authMode: "none" | "token") => {
      await updateGatewayConfig({ authMode });
    },
    [updateGatewayConfig]
  );

  const handleToggleGatewayEnabled = useCallback(async () => {
    await updateGatewayConfig({
      enabled: !(selectedRemoteProfile?.gatewayConfig?.enabled !== false),
    });
  }, [selectedRemoteProfile?.gatewayConfig?.enabled, updateGatewayConfig]);

  const handleMobileConnectTest = useCallback(() => {
    const nextToken = remoteTokenDraft.trim();
    if (nextToken !== remoteTokenDraft) {
      setRemoteTokenDraft(nextToken);
    }
    const provider = selectedRemoteProfile?.provider ?? resolvedRemoteProvider;
    if (provider === "tcp") {
      const nextHost = remoteHostDraft.trim() || DEFAULT_REMOTE_HOST;
      if (nextHost !== remoteHostDraft) {
        setRemoteHostDraft(nextHost);
      }
      void runMobileConnectTest({
        provider,
        remoteHostDraft: nextHost,
        remoteTokenDraft: nextToken,
      });
      return;
    }

    const nextOrbitWsUrl = normalizeOverrideValue(orbitWsUrlDraft) ?? "";
    if (nextOrbitWsUrl !== orbitWsUrlDraft) {
      setOrbitWsUrlDraft(nextOrbitWsUrl);
    }
    void runMobileConnectTest({
      provider,
      remoteTokenDraft: nextToken,
      orbitWsUrlDraft: nextOrbitWsUrl,
    });
  }, [
    orbitWsUrlDraft,
    remoteHostDraft,
    remoteTokenDraft,
    runMobileConnectTest,
    selectedRemoteProfile?.provider,
  ]);

  const handleRefreshTailscaleStatus = useCallback(() => {
    void refreshTailscaleStatus();
  }, [refreshTailscaleStatus]);

  const handleRefreshTailscaleCommandPreview = useCallback(() => {
    void refreshTailscaleCommandPreview();
  }, [refreshTailscaleCommandPreview]);

  const handleRefreshNetbirdStatus = useCallback(() => {
    void refreshNetbirdStatus();
  }, [refreshNetbirdStatus]);

  const handleRefreshNetbirdCommandPreview = useCallback(() => {
    void refreshNetbirdCommandPreview();
  }, [refreshNetbirdCommandPreview]);

  const handleOrbitConnectTest = useCallback(() => {
    void runOrbitConnectTest();
  }, [runOrbitConnectTest]);

  const handleOrbitSignIn = useCallback(() => {
    void runOrbitSignIn();
  }, [runOrbitSignIn]);

  const handleOrbitSignOut = useCallback(() => {
    void runOrbitSignOut();
  }, [runOrbitSignOut]);

  const handleOrbitRunnerStart = useCallback(() => {
    void runOrbitRunnerStart();
  }, [runOrbitRunnerStart]);

  const handleOrbitRunnerStop = useCallback(() => {
    void runOrbitRunnerStop();
  }, [runOrbitRunnerStop]);

  const handleOrbitRunnerStatus = useCallback(() => {
    void runOrbitRunnerStatus();
  }, [runOrbitRunnerStatus]);

  const handleChangeRemoteProvider = useCallback(
    async (provider: RemoteBackendProvider) => {
      if (provider === resolvedRemoteProvider) {
        return;
      }
      await updateSelectedRemoteProfile({ provider });
    },
    [resolvedRemoteProvider, updateSelectedRemoteProfile]
  );

  const handleChangeTcpOverlay = useCallback(
    async (tcpOverlay: RemoteTcpOverlay) => {
      if ((selectedRemoteProfile?.tcpOverlay ?? "tailscale") === tcpOverlay) {
        return;
      }
      await updateSelectedRemoteProfile({
        provider: "tcp",
        tcpOverlay,
      });
    },
    [selectedRemoteProfile?.tcpOverlay, updateSelectedRemoteProfile]
  );

  const handleBackendPoolUpsert = useCallback(() => {
    setNativeBackendEditorMode("add");
    setNativeBackendEditorDraft(createEmptyNativeBackendFormState());
    setNativeBackendEditorError(null);
    setNativeBackendEditorOpen(true);
  }, []);

  const handleNativeBackendEdit = useCallback(
    (backendId: string) => {
      const targetBackend =
        backendPoolSnapshot?.backends.find((backend) => backend.backendId === backendId) ?? null;
      if (!targetBackend || targetBackend.backendKind === "acp") {
        pushErrorToast({
          title: "Backend edit unavailable",
          message: "Runtime-native backend details are not available for this backend.",
        });
        return;
      }
      setNativeBackendEditorMode("edit");
      setNativeBackendEditorDraft(mapNativeBackendToFormState(targetBackend));
      setNativeBackendEditorError(null);
      setNativeBackendEditorOpen(true);
    },
    [backendPoolSnapshot]
  );

  const closeNativeBackendEditor = useCallback(() => {
    setNativeBackendEditorOpen(false);
    setNativeBackendEditorSaving(false);
    setNativeBackendEditorError(null);
  }, []);

  const handleNativeBackendEditorSubmit = useCallback(async () => {
    setNativeBackendEditorSaving(true);
    setNativeBackendEditorError(null);
    try {
      await upsertRuntimeBackend(mapNativeFormStateToUpsertInput(nativeBackendEditorDraft));
      closeNativeBackendEditor();
    } catch (error) {
      const fallbackTitle =
        nativeBackendEditorMode === "edit" ? "Backend edit failed" : "Backend add failed";
      const fallbackMessage =
        nativeBackendEditorMode === "edit"
          ? "Unable to save backend changes."
          : "Unable to add backend.";
      const message = formatErrorMessage(error, fallbackMessage);
      setNativeBackendEditorError(message);
      pushErrorToast({
        title: fallbackTitle,
        message,
      });
    } finally {
      setNativeBackendEditorSaving(false);
    }
  }, [
    closeNativeBackendEditor,
    nativeBackendEditorDraft,
    nativeBackendEditorMode,
    upsertRuntimeBackend,
  ]);

  const handleAcpBackendUpsert = useCallback(() => {
    setAcpEditorMode("add");
    setAcpEditorSourceIntegrationId(null);
    setAcpEditorDraft(createEmptyAcpBackendFormState());
    setAcpEditorError(null);
    setAcpEditorOpen(true);
  }, []);

  const handleAcpBackendEdit = useCallback(
    (backendId: string) => {
      const targetBackend =
        backendPoolSnapshot?.backends.find((backend) => backend.backendId === backendId) ?? null;
      const integrationId =
        targetBackend?.backendKind === "acp" ? (targetBackend.integrationId ?? null) : null;
      if (!integrationId) {
        pushErrorToast({
          title: "ACP backend edit unavailable",
          message: "ACP integration details are not available for this backend.",
        });
        return;
      }
      const integration =
        acpIntegrationsSnapshot.find((item) => item.integrationId === integrationId) ?? null;
      if (!integration) {
        pushErrorToast({
          title: "ACP backend edit unavailable",
          message: "ACP integration state is stale. Refresh the backend pool and try again.",
        });
        return;
      }
      setAcpEditorMode("edit");
      setAcpEditorSourceIntegrationId(integration.integrationId);
      setAcpEditorDraft(mapAcpIntegrationToFormState(integration));
      setAcpEditorError(null);
      setAcpEditorOpen(true);
    },
    [acpIntegrationsSnapshot, backendPoolSnapshot]
  );

  const closeAcpEditor = useCallback(() => {
    setAcpEditorOpen(false);
    setAcpEditorSourceIntegrationId(null);
    setAcpEditorSaving(false);
    setAcpEditorProbeBusy(false);
    setAcpEditorError(null);
  }, []);

  const handleAcpEditorSubmit = useCallback(async () => {
    setAcpEditorSaving(true);
    setAcpEditorError(null);
    try {
      await upsertAcpBackend(mapAcpFormStateToUpsertInput(acpEditorDraft));
      closeAcpEditor();
    } catch (error) {
      const fallbackTitle =
        acpEditorMode === "edit" ? "ACP backend edit failed" : "ACP backend add failed";
      const fallbackMessage =
        acpEditorMode === "edit"
          ? "Unable to save ACP backend changes."
          : "Unable to add ACP backend.";
      const message = formatErrorMessage(error, fallbackMessage);
      setAcpEditorError(message);
      pushErrorToast({
        title: fallbackTitle,
        message,
      });
    } finally {
      setAcpEditorSaving(false);
    }
  }, [acpEditorDraft, acpEditorMode, closeAcpEditor, upsertAcpBackend]);

  const handleAcpEditorProbe = useCallback(async () => {
    if (!acpEditorObservation?.backendId) {
      return;
    }
    setAcpEditorProbeBusy(true);
    try {
      await handleAcpBackendProbe(acpEditorObservation.backendId);
    } catch {
      // The row-level probe handler already reports the error toast.
    } finally {
      setAcpEditorProbeBusy(false);
    }
  }, [acpEditorObservation?.backendId, handleAcpBackendProbe]);

  const handleUseSuggestedTailscaleHost = useCallback(async () => {
    const suggestedHost = tailscaleStatus?.suggestedRemoteHost ?? null;
    if (!suggestedHost) {
      return;
    }
    await applyRemoteHost(suggestedHost);
  }, [applyRemoteHost, tailscaleStatus?.suggestedRemoteHost]);

  const handleUseSuggestedNetbirdHost = useCallback(async () => {
    const suggestedHost = netbirdStatus?.suggestedRemoteHost ?? null;
    if (!suggestedHost) {
      return;
    }
    await applyRemoteHost(suggestedHost);
  }, [applyRemoteHost, netbirdStatus?.suggestedRemoteHost]);

  const handleRefreshBackendPool = useCallback(() => {
    void refreshBackendPool();
  }, [refreshBackendPool]);

  const handleCommitOrbitWsUrl = useCallback(async () => {
    const nextValue = normalizeOverrideValue(orbitWsUrlDraft);
    setOrbitWsUrlDraft(nextValue ?? "");
    await updateSelectedRemoteProfile({
      provider: "orbit",
      orbitWsUrl: nextValue ?? null,
    });
  }, [orbitWsUrlDraft, updateSelectedRemoteProfile]);

  const handleCommitOrbitAuthUrl = useCallback(async () => {
    const nextValue = normalizeOverrideValue(orbitAuthUrlDraft);
    setOrbitAuthUrlDraft(nextValue ?? "");
    await updateSelectedRemoteProfile({
      orbitAuthUrl: nextValue ?? null,
    });
  }, [orbitAuthUrlDraft, updateSelectedRemoteProfile]);

  const handleCommitOrbitRunnerName = useCallback(async () => {
    const nextValue = normalizeOverrideValue(orbitRunnerNameDraft);
    setOrbitRunnerNameDraft(nextValue ?? "");
    await updateSelectedRemoteProfile({
      orbitRunnerName: nextValue ?? null,
    });
  }, [orbitRunnerNameDraft, updateSelectedRemoteProfile]);

  const handleCommitOrbitAccessClientId = useCallback(async () => {
    const nextValue = normalizeOverrideValue(orbitAccessClientIdDraft);
    setOrbitAccessClientIdDraft(nextValue ?? "");
    await updateSelectedRemoteProfile({
      orbitAccessClientId: nextValue ?? null,
    });
  }, [orbitAccessClientIdDraft, updateSelectedRemoteProfile]);

  const handleCommitOrbitAccessClientSecretRef = useCallback(async () => {
    const nextValue = normalizeOverrideValue(orbitAccessClientSecretRefDraft);
    setOrbitAccessClientSecretRefDraft(nextValue ?? "");
    await updateSelectedRemoteProfile({
      orbitAccessClientSecretRef: nextValue ?? null,
    });
  }, [orbitAccessClientSecretRefDraft, updateSelectedRemoteProfile]);

  const remoteExecutionBackendOptions = useMemo(
    () =>
      (backendPoolSnapshot?.backends ?? []).map((backend) => ({
        id: backend.backendId,
        label: backend.label,
      })),
    [backendPoolSnapshot]
  );
  const automationScheduleRecordsById = useMemo(
    () => new Map(automationSchedulesSnapshot.map((schedule) => [schedule.id, schedule] as const)),
    [automationSchedulesSnapshot]
  );
  const automationSchedules = useMemo(
    () =>
      automationSchedulesSnapshot.map((schedule) =>
        mapNativeScheduleToSummary(schedule, remoteExecutionBackendOptions)
      ),
    [automationSchedulesSnapshot, remoteExecutionBackendOptions]
  );
  const serverOperability = useMemo(
    () =>
      ({
        remoteProfiles: createSettingsServerOperabilityState(),
        transportMode: createSettingsServerOperabilityState(),
        gateway: createSettingsServerOperabilityState(),
        tcpTransport: createSettingsServerOperabilityState(),
        orbitTransport: createSettingsServerOperabilityState(),
        automationSchedules: createSettingsServerOperabilityState({
          capabilityEnabled: automationSchedulesCapabilityEnabled,
          loading: automationSchedulesLoading,
          error: automationSchedulesError,
          readOnlyReason: automationSchedulesReadOnlyReason,
          unavailableReason: automationSchedulesUnavailableReason,
        }),
      }) satisfies Record<string, SettingsServerOperabilityState>,
    [
      automationSchedulesCapabilityEnabled,
      automationSchedulesError,
      automationSchedulesLoading,
      automationSchedulesReadOnlyReason,
      automationSchedulesUnavailableReason,
    ]
  );

  const handleSelectRemoteProfile = useCallback((profileId: string) => {
    setSelectedRemoteProfileId(profileId);
  }, []);

  const handleAddRemoteProfile = useCallback(async () => {
    const nextProfile = createRemoteServerProfileDraft({
      label: `Remote backend ${remoteProfilesState.profiles.length + 1}`,
      provider: "tcp",
      host: DEFAULT_REMOTE_HOST,
    });
    const nextSettings = upsertRemoteServerProfile(latestSettingsRef.current, nextProfile);
    const savedSettings = await persistRemoteSettings(nextSettings);
    const nextState = readRemoteServerProfilesState(savedSettings, nextProfile.id);
    setSelectedRemoteProfileId(nextState.selectedProfileId);
  }, [persistRemoteSettings, remoteProfilesState.profiles.length]);

  const handleRemoveRemoteProfile = useCallback(
    async (profileId: string) => {
      const nextSettings = removeRemoteServerProfile(latestSettingsRef.current, profileId);
      const savedSettings = await persistRemoteSettings(nextSettings);
      const nextState = readRemoteServerProfilesState(savedSettings);
      setSelectedRemoteProfileId(nextState.selectedProfileId);
    },
    [persistRemoteSettings]
  );

  const handleSetDefaultRemoteProfile = useCallback(
    async (profileId: string) => {
      const nextSettings = setDefaultRemoteServerProfile(latestSettingsRef.current, profileId);
      const savedSettings = await persistRemoteSettings(nextSettings);
      const nextState = readRemoteServerProfilesState(savedSettings, profileId);
      setSelectedRemoteProfileId(nextState.selectedProfileId);
    },
    [persistRemoteSettings]
  );

  const handleCommitRemoteProfileLabel = useCallback(async () => {
    const nextLabel =
      remoteProfileLabelDraft.trim() || selectedRemoteProfile?.label || "Remote backend";
    setRemoteProfileLabelDraft(nextLabel);
    await updateSelectedRemoteProfile({
      label: nextLabel,
    });
  }, [remoteProfileLabelDraft, selectedRemoteProfile?.label, updateSelectedRemoteProfile]);

  const handleSetDefaultExecutionBackend = useCallback(
    async (backendId: string | null) => {
      const nextSettings = setDefaultRemoteExecutionBackend(latestSettingsRef.current, backendId);
      await persistRemoteSettings(nextSettings);
    },
    [persistRemoteSettings]
  );

  const handleToggleOrbitUseAccess = useCallback(async () => {
    await updateSelectedRemoteProfile({
      orbitUseAccess: !(selectedRemoteProfile?.orbitUseAccess ?? false),
    });
  }, [selectedRemoteProfile?.orbitUseAccess, updateSelectedRemoteProfile]);

  const handleRefreshAutomationSchedules = useCallback(() => {
    void refreshAutomationSchedules();
  }, [refreshAutomationSchedules]);

  const handleCreateAutomationSchedule = useCallback(
    async (draft: SettingsAutomationScheduleDraft) => {
      try {
        const created = await createAutomationSchedule({
          schedule: buildNativeSchedulePayload(draft),
        });
        if (!created) {
          throw new Error("Runtime schedule create is unavailable.");
        }
        await refreshAutomationSchedules();
      } catch (error) {
        pushErrorToast({
          title: "Schedule create failed",
          message: formatErrorMessage(error, "Unable to create the automation schedule."),
        });
      }
    },
    [createAutomationSchedule, refreshAutomationSchedules]
  );

  const handleUpdateAutomationSchedule = useCallback(
    async (scheduleId: string, draft: SettingsAutomationScheduleDraft) => {
      const existing = automationScheduleRecordsById.get(scheduleId) ?? null;
      try {
        const updated = await updateAutomationSchedule({
          scheduleId,
          schedule: buildNativeSchedulePayload(draft, existing),
        });
        if (!updated) {
          throw new Error("Runtime schedule update is unavailable.");
        }
        await refreshAutomationSchedules();
      } catch (error) {
        pushErrorToast({
          title: "Schedule update failed",
          message: formatErrorMessage(error, "Unable to save the automation schedule."),
        });
      }
    },
    [automationScheduleRecordsById, refreshAutomationSchedules, updateAutomationSchedule]
  );

  const handleAutomationScheduleAction = useCallback(
    async ({
      scheduleId,
      action,
    }: {
      scheduleId: string;
      action: SettingsAutomationScheduleAction;
    }) => {
      const existing = automationScheduleRecordsById.get(scheduleId) ?? null;
      if (!existing) {
        pushErrorToast({
          title: "Schedule action unavailable",
          message:
            "The selected automation schedule is no longer available. Refresh and try again.",
        });
        return;
      }

      try {
        if (action === "pause" || action === "resume") {
          const nextDraft = {
            ...mapNativeScheduleToDraft(
              existing,
              remoteProfilesState.defaultExecutionBackendId ?? null
            ),
            enabled: action === "resume",
          } satisfies SettingsAutomationScheduleDraft;
          const updated = await updateAutomationSchedule({
            scheduleId,
            schedule: buildNativeSchedulePayload(nextDraft, existing),
          });
          if (!updated) {
            throw new Error("Runtime schedule toggle is unavailable.");
          }
        } else if (action === "run-now") {
          const workspaceId = readScheduleText(existing, "workspaceId", "workspace_id");
          const prompt = readScheduleText(existing, "prompt", "taskPrompt", "instructions");
          if (!workspaceId || !prompt) {
            throw new Error("Select a workspace and prompt before launching this schedule.");
          }
          const updated = await runAutomationScheduleNow({ scheduleId, workspaceId });
          if (!updated) {
            throw new Error("Runtime run-now is unavailable.");
          }
        } else {
          const updated = await cancelAutomationScheduleRun({
            scheduleId,
            workspaceId: readScheduleText(existing, "workspaceId", "workspace_id"),
          });
          if (!updated) {
            throw new Error("Runtime cancel-run is unavailable.");
          }
        }
        await refreshAutomationSchedules();
      } catch (error) {
        pushErrorToast({
          title: "Schedule action failed",
          message: formatErrorMessage(error, "Unable to update the automation schedule state."),
        });
      }
    },
    [
      automationScheduleRecordsById,
      cancelAutomationScheduleRun,
      refreshAutomationSchedules,
      remoteProfilesState.defaultExecutionBackendId,
      runAutomationScheduleNow,
      updateAutomationSchedule,
    ]
  );

  return {
    mobilePlatform,
    remoteProfiles: remoteProfilesState.profiles,
    selectedRemoteProfileId: remoteProfilesState.selectedProfileId,
    defaultRemoteProfileId: remoteProfilesState.defaultProfileId,
    defaultRemoteExecutionBackendId: remoteProfilesState.defaultExecutionBackendId,
    remoteExecutionBackendOptions,
    remoteProfileLabelDraft,
    activeRemoteProvider: resolvedRemoteProvider,
    activeTcpOverlay: selectedRemoteProfile?.tcpOverlay ?? "tailscale",
    activeOrbitUseAccess: selectedRemoteProfile?.orbitUseAccess ?? false,
    setRemoteProfileLabelDraft,
    remoteHostDraft,
    setRemoteHostDraft,
    remoteTokenDraft,
    setRemoteTokenDraft,
    gatewayHttpBaseUrlDraft,
    setGatewayHttpBaseUrlDraft,
    gatewayWsBaseUrlDraft,
    setGatewayWsBaseUrlDraft,
    gatewayTokenRefDraft,
    setGatewayTokenRefDraft,
    gatewayHealthcheckPathDraft,
    setGatewayHealthcheckPathDraft,
    activeGatewayAuthMode: selectedRemoteProfile?.gatewayConfig?.authMode ?? "none",
    gatewayEnabled: selectedRemoteProfile?.gatewayConfig?.enabled !== false,
    orbitWsUrlDraft,
    setOrbitWsUrlDraft,
    orbitAuthUrlDraft,
    setOrbitAuthUrlDraft,
    orbitRunnerNameDraft,
    setOrbitRunnerNameDraft,
    orbitAccessClientIdDraft,
    setOrbitAccessClientIdDraft,
    orbitAccessClientSecretRefDraft,
    setOrbitAccessClientSecretRefDraft,
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
    handleCommitRemoteHost,
    handleCommitRemoteToken,
    handleCommitGatewayHttpBaseUrl,
    handleCommitGatewayWsBaseUrl,
    handleCommitGatewayTokenRef,
    handleCommitGatewayHealthcheckPath,
    handleSetGatewayAuthMode,
    handleToggleGatewayEnabled,
    handleChangeRemoteProvider,
    handleChangeTcpOverlay,
    handleRefreshTailscaleStatus,
    handleRefreshTailscaleCommandPreview,
    handleUseSuggestedTailscaleHost,
    handleRefreshNetbirdStatus,
    handleRefreshNetbirdCommandPreview,
    handleUseSuggestedNetbirdHost,
    handleTcpDaemonStart,
    handleTcpDaemonStop,
    handleTcpDaemonStatus,
    handleCommitOrbitWsUrl,
    handleCommitOrbitAuthUrl,
    handleCommitOrbitRunnerName,
    handleCommitOrbitAccessClientId,
    handleCommitOrbitAccessClientSecretRef,
    handleOrbitConnectTest,
    handleOrbitSignIn,
    handleOrbitSignOut,
    handleOrbitRunnerStart,
    handleOrbitRunnerStop,
    handleOrbitRunnerStatus,
    handleMobileConnectTest,
    handleSelectRemoteProfile,
    handleAddRemoteProfile,
    handleRemoveRemoteProfile,
    handleSetDefaultRemoteProfile,
    handleCommitRemoteProfileLabel,
    handleSetDefaultExecutionBackend,
    handleToggleOrbitUseAccess,
    backendPoolCapabilityEnabled,
    backendPoolSnapshot,
    backendPoolLoading,
    backendPoolError,
    backendPoolSectionReadOnlyReason,
    backendPoolStateActionsEnabled,
    backendPoolRemoveEnabled,
    backendPoolUpsertEnabled,
    backendPoolProbeEnabled,
    backendPoolBootstrapPreview,
    backendPoolBootstrapPreviewError,
    backendPoolDiagnostics,
    backendPoolDiagnosticsError,
    serverOperability,
    automationSchedules,
    automationSchedulesLoading,
    automationSchedulesError,
    automationSchedulesUnavailableReason,
    automationSchedulesReadOnlyReason,
    automationSchedulesCreateEnabled,
    automationSchedulesUpdateEnabled,
    automationSchedulesRunNowEnabled,
    automationSchedulesCancelRunEnabled,
    nativeBackendEditorOpen,
    nativeBackendEditorMode,
    nativeBackendEditorDraft,
    nativeBackendEditorSaving,
    nativeBackendEditorError,
    setNativeBackendEditorDraft,
    closeNativeBackendEditor,
    acpEditorOpen,
    acpEditorMode,
    acpEditorDraft,
    acpEditorSaving,
    acpEditorProbeBusy,
    acpEditorError,
    acpEditorObservation,
    setAcpEditorDraft,
    closeAcpEditor,
    refreshBackendPool: handleRefreshBackendPool,
    refreshAutomationSchedules: handleRefreshAutomationSchedules,
    handleCreateAutomationSchedule,
    handleUpdateAutomationSchedule,
    handleAutomationScheduleAction,
    handleBackendPoolAction,
    handleBackendPoolUpsert,
    handleNativeBackendEdit,
    handleNativeBackendEditorSubmit,
    handleAcpBackendUpsert,
    handleAcpBackendEdit,
    handleAcpBackendProbe,
    handleAcpEditorProbe,
    handleAcpEditorSubmit,
  };
}
