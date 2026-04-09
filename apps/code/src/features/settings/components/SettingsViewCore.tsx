import { useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  CodexDoctorResult,
  CodexUpdateResult,
  WorkspaceGroup,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../../../types";
import { isMacPlatform } from "../../../utils/platformPaths";
import { useGlobalAgentsMd } from "../hooks/useGlobalAgentsMd";
import { useGlobalCodexConfigToml } from "../hooks/useGlobalCodexConfigToml";
import { useSettingsCodexBinaryState } from "../hooks/useSettingsCodexBinaryState";
import { useSettingsCodexHealthState } from "../hooks/useSettingsCodexHealthState";
import { useSettingsCodexOverridesState } from "../hooks/useSettingsCodexOverridesState";
import { useSettingsDefaultModels } from "../hooks/useSettingsDefaultModels";
import { useSettingsDisplayState } from "../hooks/useSettingsDisplayState";
import { useSettingsEnvironmentState } from "../hooks/useSettingsEnvironmentState";
import { useSettingsGitPromptState } from "../hooks/useSettingsGitPromptState";
import { useSettingsOpenAppDrafts } from "../hooks/useSettingsOpenAppDrafts";
import { useSettingsServerState } from "../hooks/useSettingsServerState";
import { useSettingsShortcutDrafts } from "../hooks/useSettingsShortcutDrafts";
import { useSettingsViewCloseShortcuts } from "../hooks/useSettingsViewCloseShortcuts";
import { useSettingsViewNavigation } from "../hooks/useSettingsViewNavigation";
import { useSettingsWorkspaceGroupActions } from "../hooks/useSettingsWorkspaceGroupActions";
import { type CodexSection, SettingsViewShell } from "@ku0/code-workspace-client/settings-shell";
import { SettingsSectionContent } from "./SettingsSectionContent";
import { desktopSettingsShellFraming } from "./desktopSettingsShellFraming";
import { AcpBackendEditorDialog } from "./sections/settings-backend-pool/AcpBackendEditorDialog";
import { NativeBackendEditorDialog } from "./sections/settings-backend-pool/NativeBackendAddDialog";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import type { OrbitServiceClient } from "./settingsTypes";
import {
  COMPOSER_PRESET_CONFIGS,
  COMPOSER_PRESET_LABELS,
  ORBIT_SERVICES,
} from "./settingsViewConstants";
import { buildEditorContentMeta, formatErrorMessage } from "./settingsViewHelpers";

export type SettingsViewProps = {
  workspaceGroups: WorkspaceGroup[];
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  ungroupedLabel: string;
  onClose: () => void;
  onMoveWorkspace: (id: string, direction: "up" | "down") => void;
  onDeleteWorkspace: (id: string) => void;
  onRenameWorkspace?: (workspaceId: string, name: string) => Promise<boolean | null>;
  onCreateWorkspaceGroup: (name: string) => Promise<WorkspaceGroup | null>;
  onRenameWorkspaceGroup: (id: string, name: string) => Promise<boolean | null>;
  onMoveWorkspaceGroup: (id: string, direction: "up" | "down") => Promise<boolean | null>;
  onDeleteWorkspaceGroup: (id: string) => Promise<boolean | null>;
  onAssignWorkspaceGroup: (workspaceId: string, groupId: string | null) => Promise<boolean | null>;
  reduceTransparency: boolean;
  onToggleTransparency: (value: boolean) => void;
  appSettings: AppSettings;
  openAppIconById: Record<string, string>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onRunDoctor: (codexBin: string | null, codexArgs: string | null) => Promise<CodexDoctorResult>;
  onRunCodexUpdate?: (
    codexBin: string | null,
    codexArgs: string | null
  ) => Promise<CodexUpdateResult>;
  onUpdateWorkspaceCodexBin: (id: string, codexBin: string | null) => Promise<void>;
  onUpdateWorkspaceSettings: (id: string, settings: Partial<WorkspaceSettings>) => Promise<void>;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  onTestNotificationSound: () => void;
  onTestSystemNotification: () => void;
  onMobileConnectSuccess?: () => Promise<void> | void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void | Promise<void>;
  initialSection?: CodexSection;
  orbitServiceClient?: OrbitServiceClient;
};

export function SettingsView({
  workspaceGroups,
  groupedWorkspaces,
  ungroupedLabel,
  onClose,
  onMoveWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
  onCreateWorkspaceGroup,
  onRenameWorkspaceGroup,
  onMoveWorkspaceGroup,
  onDeleteWorkspaceGroup,
  onAssignWorkspaceGroup,
  reduceTransparency,
  onToggleTransparency,
  appSettings,
  openAppIconById,
  onUpdateAppSettings,
  onRunDoctor,
  onRunCodexUpdate,
  onUpdateWorkspaceCodexBin,
  onUpdateWorkspaceSettings,
  scaleShortcutTitle,
  scaleShortcutText,
  onTestNotificationSound,
  onTestSystemNotification,
  onMobileConnectSuccess,
  onOpenMissionTarget,
  initialSection,
  orbitServiceClient = ORBIT_SERVICES,
}: SettingsViewProps) {
  const {
    activeSection,
    showMobileDetail,
    setShowMobileDetail,
    useMobileMasterDetail,
    handleSelectSection,
  } = useSettingsViewNavigation({ initialSection });
  const [codexSectionActivated, setCodexSectionActivated] = useState(initialSection === "codex");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const {
    openAppDrafts,
    openAppSelectedId,
    handleOpenAppDraftChange,
    handleOpenAppKindChange,
    handleCommitOpenAppsDrafts,
    handleMoveOpenApp,
    handleDeleteOpenApp,
    handleAddOpenApp,
    handleSelectOpenAppDefault,
  } = useSettingsOpenAppDrafts({
    appSettings,
    onUpdateAppSettings,
  });
  useEffect(() => {
    if (activeSection === "codex") {
      setCodexSectionActivated(true);
    }
  }, [activeSection]);

  const {
    content: globalAgentsContent,
    exists: globalAgentsExists,
    truncated: globalAgentsTruncated,
    isLoading: globalAgentsLoading,
    isSaving: globalAgentsSaving,
    error: globalAgentsError,
    isDirty: globalAgentsDirty,
    setContent: setGlobalAgentsContent,
    refresh: refreshGlobalAgents,
    save: saveGlobalAgents,
  } = useGlobalAgentsMd(codexSectionActivated);
  const {
    content: globalConfigContent,
    exists: globalConfigExists,
    truncated: globalConfigTruncated,
    isLoading: globalConfigLoading,
    isSaving: globalConfigSaving,
    error: globalConfigError,
    isDirty: globalConfigDirty,
    setContent: setGlobalConfigContent,
    refresh: refreshGlobalConfig,
    save: saveGlobalConfig,
  } = useGlobalCodexConfigToml(codexSectionActivated);
  const { shortcutDrafts, handleShortcutKeyDown, clearShortcut } = useSettingsShortcutDrafts({
    appSettings,
    onUpdateAppSettings,
  });
  const {
    mobilePlatform,
    remoteProfiles,
    selectedRemoteProfileId,
    defaultRemoteProfileId,
    defaultRemoteExecutionBackendId,
    remoteExecutionBackendOptions,
    remoteProfileLabelDraft,
    activeRemoteProvider,
    activeTcpOverlay,
    activeOrbitUseAccess,
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
    activeGatewayAuthMode,
    gatewayEnabled,
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
    refreshBackendPool,
    refreshAutomationSchedules,
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
  } = useSettingsServerState({
    activeSection,
    appSettings,
    onUpdateAppSettings,
    onMobileConnectSuccess,
    orbitServiceClient,
  });
  const globalAgentsEditorMeta = buildEditorContentMeta({
    isLoading: globalAgentsLoading,
    isSaving: globalAgentsSaving,
    exists: globalAgentsExists,
    truncated: globalAgentsTruncated,
    isDirty: globalAgentsDirty,
  });
  const globalConfigEditorMeta = buildEditorContentMeta({
    isLoading: globalConfigLoading,
    isSaving: globalConfigSaving,
    exists: globalConfigExists,
    truncated: globalConfigTruncated,
    isDirty: globalConfigDirty,
  });
  const globalAgentsMeta = globalAgentsEditorMeta.meta;
  const globalAgentsSaveLabel = globalAgentsEditorMeta.saveLabel;
  const globalAgentsSaveDisabled = globalAgentsEditorMeta.saveDisabled;
  const globalAgentsRefreshDisabled = globalAgentsEditorMeta.refreshDisabled;
  const globalConfigMeta = globalConfigEditorMeta.meta;
  const globalConfigSaveLabel = globalConfigEditorMeta.saveLabel;
  const globalConfigSaveDisabled = globalConfigEditorMeta.saveDisabled;
  const globalConfigRefreshDisabled = globalConfigEditorMeta.refreshDisabled;
  const optionKeyLabel = isMacPlatform() ? "Option" : "Alt";

  const projects = useMemo(
    () => groupedWorkspaces.flatMap((group) => group.workspaces),
    [groupedWorkspaces]
  );
  const {
    models: defaultModels,
    isLoading: defaultModelsLoading,
    error: defaultModelsError,
    connectedWorkspaceCount: defaultModelsConnectedWorkspaceCount,
    refresh: refreshDefaultModels,
  } = useSettingsDefaultModels(projects, codexSectionActivated);
  const {
    mainWorkspaces,
    environmentWorkspace,
    environmentSaving,
    environmentError,
    environmentDraftScript,
    environmentSavedScript,
    environmentDirty,
    setEnvironmentWorkspaceId,
    setEnvironmentDraftScript,
    handleSaveEnvironmentSetup,
  } = useSettingsEnvironmentState({
    projects,
    onUpdateWorkspaceSettings,
  });
  const {
    scaleDraft,
    setScaleDraft,
    uiFontDraft,
    setUiFontDraft,
    codeFontDraft,
    setCodeFontDraft,
    codeFontSizeDraft,
    setCodeFontSizeDraft,
    handleCommitScale,
    handleResetScale,
    handleCommitUiFont,
    handleCommitCodeFont,
    handleCommitCodeFontSize,
  } = useSettingsDisplayState({
    appSettings,
    onUpdateAppSettings,
  });
  const {
    codexPathDraft,
    setCodexPathDraft,
    codexArgsDraft,
    setCodexArgsDraft,
    isSavingSettings,
    nextCodexBin,
    nextCodexArgs,
    codexDirty,
    handleSaveCodexSettings,
  } = useSettingsCodexBinaryState({
    appSettings,
    onUpdateAppSettings,
  });
  const {
    codexBinOverrideDrafts,
    setCodexBinOverrideDrafts,
    codexHomeOverrideDrafts,
    setCodexHomeOverrideDrafts,
    codexArgsOverrideDrafts,
    setCodexArgsOverrideDrafts,
    openConfigError,
    handleOpenConfig,
    handleBrowseCodex,
  } = useSettingsCodexOverridesState({
    projects,
    setCodexPathDraft,
  });
  const { doctorState, codexUpdateState, handleRunDoctor, handleRunCodexUpdate } =
    useSettingsCodexHealthState({
      nextCodexBin,
      nextCodexArgs,
      onRunDoctor,
      onRunCodexUpdate,
    });
  const {
    commitMessagePromptDraft,
    setCommitMessagePromptDraft,
    commitMessagePromptSaving,
    commitMessagePromptDirty,
    handleSaveCommitMessagePrompt,
    handleResetCommitMessagePrompt,
  } = useSettingsGitPromptState({
    appSettings,
    onUpdateAppSettings,
  });
  const hasCodexHomeOverrides = useMemo(
    () => projects.some((workspace) => workspace.settings.codexHome != null),
    [projects]
  );

  useSettingsViewCloseShortcuts(onClose);

  useEffect(() => {
    setGroupDrafts((prev) => {
      const next: Record<string, string> = {};
      workspaceGroups.forEach((group) => {
        next[group.id] = prev[group.id] ?? group.name;
      });
      return next;
    });
  }, [workspaceGroups]);

  const handleComposerPresetChange = (preset: AppSettings["composerEditorPreset"]) => {
    const config = COMPOSER_PRESET_CONFIGS[preset];
    void onUpdateAppSettings({
      ...appSettings,
      composerEditorPreset: preset,
      ...config,
    });
  };

  const {
    canCreateGroup,
    handleCreateGroup,
    handleRenameGroup,
    handleChooseGroupCopiesFolder,
    handleClearGroupCopiesFolder,
    handleDeleteGroup,
  } = useSettingsWorkspaceGroupActions({
    appSettings,
    groupedWorkspaces,
    groupDrafts,
    newGroupName,
    onCreateWorkspaceGroup,
    onDeleteWorkspaceGroup,
    onRenameWorkspaceGroup,
    onUpdateAppSettings,
    setGroupDrafts,
    setGroupError,
    setNewGroupName,
    ungroupedLabel,
    formatErrorMessage,
  });
  return (
    <SettingsViewShell
      activeSection={activeSection}
      framing={desktopSettingsShellFraming}
      useMobileMasterDetail={useMobileMasterDetail}
      showMobileDetail={showMobileDetail}
      onClose={onClose}
      onSelectSection={handleSelectSection}
      onBackToSections={() => setShowMobileDetail(false)}
    >
      <SettingsSectionContent
        activeSection={activeSection}
        projectsSectionProps={{
          workspaceGroups,
          groupedWorkspaces,
          ungroupedLabel,
          groupDrafts,
          newGroupName,
          groupError,
          projects,
          canCreateGroup,
          onSetNewGroupName: setNewGroupName,
          onSetGroupDrafts: setGroupDrafts,
          onCreateGroup: handleCreateGroup,
          onRenameGroup: handleRenameGroup,
          onMoveWorkspaceGroup,
          onDeleteGroup: handleDeleteGroup,
          onChooseGroupCopiesFolder: handleChooseGroupCopiesFolder,
          onClearGroupCopiesFolder: handleClearGroupCopiesFolder,
          onAssignWorkspaceGroup,
          onRenameWorkspace,
          onMoveWorkspace,
          onDeleteWorkspace,
        }}
        environmentsSectionProps={{
          mainWorkspaces,
          environmentWorkspace,
          environmentSaving,
          environmentError,
          environmentDraftScript,
          environmentSavedScript,
          environmentDirty,
          onSetEnvironmentWorkspaceId: setEnvironmentWorkspaceId,
          onSetEnvironmentDraftScript: setEnvironmentDraftScript,
          onSaveEnvironmentSetup: handleSaveEnvironmentSetup,
        }}
        displaySectionProps={{
          appSettings,
          reduceTransparency,
          scaleShortcutTitle,
          scaleShortcutText,
          scaleDraft,
          uiFontDraft,
          codeFontDraft,
          codeFontSizeDraft,
          onUpdateAppSettings,
          onToggleTransparency,
          onSetScaleDraft: setScaleDraft,
          onCommitScale: handleCommitScale,
          onResetScale: handleResetScale,
          onSetUiFontDraft: setUiFontDraft,
          onCommitUiFont: handleCommitUiFont,
          onSetCodeFontDraft: setCodeFontDraft,
          onCommitCodeFont: handleCommitCodeFont,
          onSetCodeFontSizeDraft: setCodeFontSizeDraft,
          onCommitCodeFontSize: handleCommitCodeFontSize,
          onTestNotificationSound,
          onTestSystemNotification,
        }}
        composerSectionProps={{
          appSettings,
          optionKeyLabel,
          composerPresetLabels: COMPOSER_PRESET_LABELS,
          onComposerPresetChange: handleComposerPresetChange,
          onUpdateAppSettings,
        }}
        shortcutsSectionProps={{
          shortcutDrafts,
          onShortcutKeyDown: handleShortcutKeyDown,
          onClearShortcut: clearShortcut,
        }}
        openAppsSectionProps={{
          openAppDrafts,
          openAppSelectedId,
          openAppIconById,
          onOpenAppDraftChange: handleOpenAppDraftChange,
          onOpenAppKindChange: handleOpenAppKindChange,
          onCommitOpenApps: handleCommitOpenAppsDrafts,
          onMoveOpenApp: handleMoveOpenApp,
          onDeleteOpenApp: handleDeleteOpenApp,
          onAddOpenApp: handleAddOpenApp,
          onSelectOpenAppDefault: handleSelectOpenAppDefault,
        }}
        gitSectionProps={{
          appSettings,
          onUpdateAppSettings,
          commitMessagePromptDraft,
          commitMessagePromptDirty,
          commitMessagePromptSaving,
          onSetCommitMessagePromptDraft: setCommitMessagePromptDraft,
          onSaveCommitMessagePrompt: handleSaveCommitMessagePrompt,
          onResetCommitMessagePrompt: handleResetCommitMessagePrompt,
        }}
        serverSectionProps={{
          appSettings,
          onUpdateAppSettings,
          remoteProfiles,
          selectedRemoteProfileId,
          defaultRemoteProfileId,
          defaultRemoteExecutionBackendId,
          remoteExecutionBackendOptions,
          remoteProfileLabelDraft,
          activeRemoteProvider,
          activeTcpOverlay,
          activeOrbitUseAccess,
          remoteHostDraft,
          remoteTokenDraft,
          gatewayHttpBaseUrlDraft,
          gatewayWsBaseUrlDraft,
          gatewayTokenRefDraft,
          gatewayHealthcheckPathDraft,
          activeGatewayAuthMode,
          gatewayEnabled,
          orbitWsUrlDraft,
          orbitAuthUrlDraft,
          orbitRunnerNameDraft,
          orbitAccessClientIdDraft,
          orbitAccessClientSecretRefDraft,
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
          onSetRemoteHostDraft: setRemoteHostDraft,
          onSetRemoteProfileLabelDraft: setRemoteProfileLabelDraft,
          onSetRemoteTokenDraft: setRemoteTokenDraft,
          onSetGatewayHttpBaseUrlDraft: setGatewayHttpBaseUrlDraft,
          onSetGatewayWsBaseUrlDraft: setGatewayWsBaseUrlDraft,
          onSetGatewayTokenRefDraft: setGatewayTokenRefDraft,
          onSetGatewayHealthcheckPathDraft: setGatewayHealthcheckPathDraft,
          onSetOrbitWsUrlDraft: setOrbitWsUrlDraft,
          onSetOrbitAuthUrlDraft: setOrbitAuthUrlDraft,
          onSetOrbitRunnerNameDraft: setOrbitRunnerNameDraft,
          onSetOrbitAccessClientIdDraft: setOrbitAccessClientIdDraft,
          onSetOrbitAccessClientSecretRefDraft: setOrbitAccessClientSecretRefDraft,
          onCommitRemoteHost: handleCommitRemoteHost,
          onCommitRemoteProfileLabel: handleCommitRemoteProfileLabel,
          onCommitRemoteToken: handleCommitRemoteToken,
          onCommitGatewayHttpBaseUrl: handleCommitGatewayHttpBaseUrl,
          onCommitGatewayWsBaseUrl: handleCommitGatewayWsBaseUrl,
          onCommitGatewayTokenRef: handleCommitGatewayTokenRef,
          onCommitGatewayHealthcheckPath: handleCommitGatewayHealthcheckPath,
          onSetGatewayAuthMode: handleSetGatewayAuthMode,
          onToggleGatewayEnabled: handleToggleGatewayEnabled,
          onChangeRemoteProvider: handleChangeRemoteProvider,
          onChangeTcpOverlay: handleChangeTcpOverlay,
          onSelectRemoteProfile: handleSelectRemoteProfile,
          onAddRemoteProfile: handleAddRemoteProfile,
          onRemoveRemoteProfile: handleRemoveRemoteProfile,
          onSetDefaultRemoteProfile: handleSetDefaultRemoteProfile,
          onSetDefaultExecutionBackend: handleSetDefaultExecutionBackend,
          onToggleOrbitUseAccess: handleToggleOrbitUseAccess,
          onRefreshTailscaleStatus: handleRefreshTailscaleStatus,
          onRefreshTailscaleCommandPreview: handleRefreshTailscaleCommandPreview,
          onUseSuggestedTailscaleHost: handleUseSuggestedTailscaleHost,
          onRefreshNetbirdStatus: handleRefreshNetbirdStatus,
          onRefreshNetbirdCommandPreview: handleRefreshNetbirdCommandPreview,
          onUseSuggestedNetbirdHost: handleUseSuggestedNetbirdHost,
          onTcpDaemonStart: handleTcpDaemonStart,
          onTcpDaemonStop: handleTcpDaemonStop,
          onTcpDaemonStatus: handleTcpDaemonStatus,
          onCommitOrbitWsUrl: handleCommitOrbitWsUrl,
          onCommitOrbitAuthUrl: handleCommitOrbitAuthUrl,
          onCommitOrbitRunnerName: handleCommitOrbitRunnerName,
          onCommitOrbitAccessClientId: handleCommitOrbitAccessClientId,
          onCommitOrbitAccessClientSecretRef: handleCommitOrbitAccessClientSecretRef,
          onOrbitConnectTest: handleOrbitConnectTest,
          onOrbitSignIn: handleOrbitSignIn,
          onOrbitSignOut: handleOrbitSignOut,
          onOrbitRunnerStart: handleOrbitRunnerStart,
          onOrbitRunnerStop: handleOrbitRunnerStop,
          onOrbitRunnerStatus: handleOrbitRunnerStatus,
          isMobilePlatform: mobilePlatform,
          mobileConnectBusy,
          mobileConnectStatusText,
          mobileConnectStatusError,
          onMobileConnectTest: handleMobileConnectTest,
          remoteProfilesOperability: serverOperability.remoteProfiles,
          transportModeOperability: serverOperability.transportMode,
          gatewayOperability: serverOperability.gateway,
          tcpTransportOperability: serverOperability.tcpTransport,
          orbitTransportOperability: serverOperability.orbitTransport,
          backendPoolVisible: backendPoolCapabilityEnabled,
          backendPool: backendPoolCapabilityEnabled ? backendPoolSnapshot : null,
          backendPoolLoading,
          backendPoolError,
          backendPoolReadOnlyReason: backendPoolSectionReadOnlyReason,
          backendPoolStateActionsEnabled:
            backendPoolCapabilityEnabled && backendPoolStateActionsEnabled && !backendPoolLoading,
          backendPoolRemoveEnabled:
            backendPoolCapabilityEnabled && backendPoolRemoveEnabled && !backendPoolLoading,
          backendPoolUpsertEnabled:
            backendPoolCapabilityEnabled && backendPoolUpsertEnabled && !backendPoolLoading,
          backendPoolProbeEnabled:
            backendPoolCapabilityEnabled && backendPoolProbeEnabled && !backendPoolLoading,
          backendPoolEditEnabled:
            backendPoolCapabilityEnabled && backendPoolUpsertEnabled && !backendPoolLoading,
          backendPoolBootstrapPreview: backendPoolCapabilityEnabled
            ? backendPoolBootstrapPreview
            : null,
          backendPoolBootstrapPreviewError: backendPoolCapabilityEnabled
            ? backendPoolBootstrapPreviewError
            : null,
          backendPoolDiagnostics: backendPoolCapabilityEnabled ? backendPoolDiagnostics : null,
          backendPoolDiagnosticsError: backendPoolCapabilityEnabled
            ? backendPoolDiagnosticsError
            : null,
          workspaceOptions: projects.map((workspace) => ({
            id: workspace.id,
            label: workspace.name,
          })),
          automationSchedules,
          automationSchedulesOperability: serverOperability.automationSchedules,
          automationScheduleActionAvailability: {
            createEnabled: automationSchedulesCreateEnabled,
            updateEnabled: automationSchedulesUpdateEnabled,
            runNowEnabled: automationSchedulesRunNowEnabled,
            cancelRunEnabled: automationSchedulesCancelRunEnabled,
          },
          onRefreshAutomationSchedules: () => {
            void refreshAutomationSchedules();
          },
          onCreateAutomationSchedule: handleCreateAutomationSchedule,
          onUpdateAutomationSchedule: handleUpdateAutomationSchedule,
          onAutomationScheduleAction: handleAutomationScheduleAction,
          onOpenMissionTarget,
          onRefreshBackendPool: () => {
            void refreshBackendPool();
          },
          onBackendPoolAction: handleBackendPoolAction,
          onBackendPoolUpsert: handleBackendPoolUpsert,
          onNativeBackendEdit: handleNativeBackendEdit,
          onAcpBackendUpsert: handleAcpBackendUpsert,
          onAcpBackendEdit: handleAcpBackendEdit,
          onAcpBackendProbe: handleAcpBackendProbe,
        }}
        codexSectionProps={{
          appSettings,
          onUpdateAppSettings,
          defaultModels,
          defaultModelsLoading,
          defaultModelsError,
          defaultModelsConnectedWorkspaceCount,
          onRefreshDefaultModels: () => {
            void refreshDefaultModels();
          },
          codexPathDraft,
          codexArgsDraft,
          codexDirty,
          isSavingSettings,
          doctorState,
          codexUpdateState,
          globalAgentsMeta,
          globalAgentsError,
          globalAgentsContent,
          globalAgentsLoading,
          globalAgentsRefreshDisabled,
          globalAgentsSaveDisabled,
          globalAgentsSaveLabel,
          globalConfigMeta,
          globalConfigError,
          globalConfigContent,
          globalConfigLoading,
          globalConfigRefreshDisabled,
          globalConfigSaveDisabled,
          globalConfigSaveLabel,
          projects,
          codexBinOverrideDrafts,
          codexHomeOverrideDrafts,
          codexArgsOverrideDrafts,
          onSetCodexPathDraft: setCodexPathDraft,
          onSetCodexArgsDraft: setCodexArgsDraft,
          onSetGlobalAgentsContent: setGlobalAgentsContent,
          onSetGlobalConfigContent: setGlobalConfigContent,
          onSetCodexBinOverrideDrafts: setCodexBinOverrideDrafts,
          onSetCodexHomeOverrideDrafts: setCodexHomeOverrideDrafts,
          onSetCodexArgsOverrideDrafts: setCodexArgsOverrideDrafts,
          onBrowseCodex: handleBrowseCodex,
          onSaveCodexSettings: handleSaveCodexSettings,
          onRunDoctor: handleRunDoctor,
          onRunCodexUpdate: handleRunCodexUpdate,
          onRefreshGlobalAgents: () => {
            void refreshGlobalAgents();
          },
          onSaveGlobalAgents: () => {
            void saveGlobalAgents();
          },
          onRefreshGlobalConfig: () => {
            void refreshGlobalConfig();
          },
          onSaveGlobalConfig: () => {
            void saveGlobalConfig();
          },
          onUpdateWorkspaceCodexBin,
          onUpdateWorkspaceSettings,
        }}
        featuresSectionProps={{
          appSettings,
          hasCodexHomeOverrides,
          openConfigError,
          onOpenConfig: () => {
            void handleOpenConfig();
          },
          onUpdateAppSettings,
        }}
      />
      <NativeBackendEditorDialog
        open={nativeBackendEditorOpen}
        mode={nativeBackendEditorMode}
        draft={nativeBackendEditorDraft}
        saving={nativeBackendEditorSaving}
        error={nativeBackendEditorError}
        onClose={closeNativeBackendEditor}
        onDraftChange={setNativeBackendEditorDraft}
        onSubmit={() => {
          void handleNativeBackendEditorSubmit();
        }}
      />
      <AcpBackendEditorDialog
        open={acpEditorOpen}
        mode={acpEditorMode}
        draft={acpEditorDraft}
        saving={acpEditorSaving}
        probeBusy={acpEditorProbeBusy}
        probeEnabled={backendPoolProbeEnabled && !backendPoolLoading}
        error={acpEditorError}
        integrationObservation={acpEditorObservation}
        onClose={closeAcpEditor}
        onDraftChange={setAcpEditorDraft}
        onSubmit={() => {
          void handleAcpEditorSubmit();
        }}
        onProbe={() => {
          void handleAcpEditorProbe();
        }}
      />
    </SettingsViewShell>
  );
}
