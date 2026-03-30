import type { Dispatch, SetStateAction } from "react";
import { Select, type SelectOption } from "../../../../design-system";
import type { MissionNavigationTarget } from "../../../missions/utils/missionControlPresentation";
import type {
  AppSettings,
  BackendPoolBootstrapPreview,
  BackendPoolDiagnostics,
  NetbirdDaemonCommandPreview,
  NetbirdStatus,
  RemoteBackendProfile,
  RemoteBackendProvider,
  RemoteTcpOverlay,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "../../../../types";
import { SettingsField, SettingsFieldGroup, SettingsSectionFrame } from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import {
  SettingsAutomationSection,
  type SettingsAutomationScheduleAction,
  type SettingsAutomationScheduleActionAvailability,
  type SettingsAutomationScheduleDraft,
  type SettingsAutomationScheduleSummary,
} from "./SettingsAutomationSection";
import type { BackendPoolSnapshot } from "../../types/backendPool";
import { buildSettingsServerSectionViewModel } from "./settingsServerSectionViewModel";
import { SettingsBackendPoolSection } from "./SettingsBackendPoolSection";
import { SettingsRemoteProfilesFieldGroup } from "./settings-server-section/SettingsRemoteProfilesFieldGroup";
import { SettingsTransportModeFieldGroup } from "./settings-server-section/SettingsTransportModeFieldGroup";
import { SettingsTcpTransportSections } from "./settings-server-section/SettingsTcpTransportSections";
import { SettingsWebRuntimeGatewayFieldGroup } from "./settings-server-section/SettingsWebRuntimeGatewayFieldGroup";
import { SettingsOrbitTransportSections } from "./settings-server-section/SettingsOrbitTransportSections";
import type {
  SettingsServerCompactSelectProps,
  SettingsServerOperabilityState,
} from "./settings-server-section/shared";

type SettingsServerSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  remoteProfiles: RemoteBackendProfile[];
  selectedRemoteProfileId: string | null;
  defaultRemoteProfileId: string | null;
  defaultRemoteExecutionBackendId: string | null;
  remoteExecutionBackendOptions: Array<{ id: string; label: string }>;
  remoteProfileLabelDraft: string;
  activeRemoteProvider: RemoteBackendProvider;
  activeTcpOverlay: RemoteTcpOverlay;
  activeOrbitUseAccess: boolean;
  isMobilePlatform: boolean;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  remoteHostDraft: string;
  remoteTokenDraft: string;
  gatewayHttpBaseUrlDraft: string;
  gatewayWsBaseUrlDraft: string;
  gatewayTokenRefDraft: string;
  gatewayHealthcheckPathDraft: string;
  activeGatewayAuthMode: "none" | "token";
  gatewayEnabled: boolean;
  orbitWsUrlDraft: string;
  orbitAuthUrlDraft: string;
  orbitRunnerNameDraft: string;
  orbitAccessClientIdDraft: string;
  orbitAccessClientSecretRefDraft: string;
  orbitStatusText: string | null;
  orbitAuthCode: string | null;
  orbitVerificationUrl: string | null;
  orbitBusyAction: string | null;
  tailscaleStatus: TailscaleStatus | null;
  tailscaleStatusBusy: boolean;
  tailscaleStatusError: string | null;
  tailscaleCommandPreview: TailscaleDaemonCommandPreview | null;
  tailscaleCommandBusy: boolean;
  tailscaleCommandError: string | null;
  netbirdStatus: NetbirdStatus | null;
  netbirdStatusBusy: boolean;
  netbirdStatusError: string | null;
  netbirdCommandPreview: NetbirdDaemonCommandPreview | null;
  netbirdCommandBusy: boolean;
  netbirdCommandError: string | null;
  tcpDaemonStatus: TcpDaemonStatus | null;
  tcpDaemonBusyAction: "start" | "stop" | "status" | null;
  onSetRemoteProfileLabelDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteHostDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayHttpBaseUrlDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayWsBaseUrlDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayTokenRefDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayHealthcheckPathDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitWsUrlDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAuthUrlDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitRunnerNameDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAccessClientIdDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAccessClientSecretRefDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteProfileLabel: () => Promise<void>;
  onCommitRemoteHost: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onCommitGatewayHttpBaseUrl: () => Promise<void>;
  onCommitGatewayWsBaseUrl: () => Promise<void>;
  onCommitGatewayTokenRef: () => Promise<void>;
  onCommitGatewayHealthcheckPath: () => Promise<void>;
  onSetGatewayAuthMode: (authMode: "none" | "token") => Promise<void>;
  onToggleGatewayEnabled: () => Promise<void>;
  onChangeRemoteProvider: (provider: RemoteBackendProvider) => Promise<void>;
  onChangeTcpOverlay: (tcpOverlay: RemoteTcpOverlay) => Promise<void>;
  onSelectRemoteProfile: (profileId: string) => void;
  onAddRemoteProfile: () => Promise<void>;
  onRemoveRemoteProfile: (profileId: string) => Promise<void>;
  onSetDefaultRemoteProfile: (profileId: string) => Promise<void>;
  onSetDefaultExecutionBackend: (backendId: string | null) => Promise<void>;
  onRefreshTailscaleStatus: () => void;
  onRefreshTailscaleCommandPreview: () => void;
  onUseSuggestedTailscaleHost: () => Promise<void>;
  onRefreshNetbirdStatus: () => void;
  onRefreshNetbirdCommandPreview: () => void;
  onUseSuggestedNetbirdHost: () => Promise<void>;
  onTcpDaemonStart: () => Promise<void>;
  onTcpDaemonStop: () => Promise<void>;
  onTcpDaemonStatus: () => Promise<void>;
  onCommitOrbitWsUrl: () => Promise<void>;
  onCommitOrbitAuthUrl: () => Promise<void>;
  onCommitOrbitRunnerName: () => Promise<void>;
  onCommitOrbitAccessClientId: () => Promise<void>;
  onCommitOrbitAccessClientSecretRef: () => Promise<void>;
  onToggleOrbitUseAccess: () => Promise<void>;
  onOrbitConnectTest: () => void;
  onOrbitSignIn: () => void;
  onOrbitSignOut: () => void;
  onOrbitRunnerStart: () => void;
  onOrbitRunnerStop: () => void;
  onOrbitRunnerStatus: () => void;
  onMobileConnectTest: () => void;
  remoteProfilesOperability: SettingsServerOperabilityState;
  transportModeOperability: SettingsServerOperabilityState;
  gatewayOperability: SettingsServerOperabilityState;
  tcpTransportOperability: SettingsServerOperabilityState;
  orbitTransportOperability: SettingsServerOperabilityState;
  backendPoolVisible: boolean;
  backendPool: BackendPoolSnapshot | null;
  backendPoolLoading: boolean;
  backendPoolError: string | null;
  backendPoolReadOnlyReason: string | null;
  backendPoolStateActionsEnabled: boolean;
  backendPoolRemoveEnabled: boolean;
  backendPoolUpsertEnabled: boolean;
  backendPoolProbeEnabled: boolean;
  backendPoolEditEnabled: boolean;
  backendPoolBootstrapPreview: BackendPoolBootstrapPreview | null;
  backendPoolBootstrapPreviewError: string | null;
  backendPoolDiagnostics: BackendPoolDiagnostics | null;
  backendPoolDiagnosticsError: string | null;
  onRefreshBackendPool: () => void;
  onBackendPoolAction: (request: {
    backendId: string;
    action: "drain" | "disable" | "enable" | "remove";
  }) => Promise<void>;
  onBackendPoolUpsert: () => void | Promise<void>;
  onNativeBackendEdit: (backendId: string) => void;
  onAcpBackendUpsert: () => void | Promise<void>;
  onAcpBackendEdit: (backendId: string) => void;
  onAcpBackendProbe: (backendId: string) => Promise<void>;
  workspaceOptions: Array<{ id: string; label: string }>;
  automationSchedules?: SettingsAutomationScheduleSummary[];
  automationSchedulesOperability: SettingsServerOperabilityState;
  automationScheduleActionAvailability?: SettingsAutomationScheduleActionAvailability;
  onRefreshAutomationSchedules?: () => void | Promise<void>;
  onCreateAutomationSchedule?: (draft: SettingsAutomationScheduleDraft) => void | Promise<void>;
  onUpdateAutomationSchedule?: (
    scheduleId: string,
    draft: SettingsAutomationScheduleDraft
  ) => void | Promise<void>;
  onAutomationScheduleAction?: (request: {
    scheduleId: string;
    action: SettingsAutomationScheduleAction;
  }) => void | Promise<void>;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void | Promise<void>;
};

export function SettingsServerSection({
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
  isMobilePlatform,
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
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
  onSetRemoteProfileLabelDraft,
  onSetRemoteHostDraft,
  onSetRemoteTokenDraft,
  onSetGatewayHttpBaseUrlDraft,
  onSetGatewayWsBaseUrlDraft,
  onSetGatewayTokenRefDraft,
  onSetGatewayHealthcheckPathDraft,
  onSetOrbitWsUrlDraft,
  onSetOrbitAuthUrlDraft,
  onSetOrbitRunnerNameDraft,
  onSetOrbitAccessClientIdDraft,
  onSetOrbitAccessClientSecretRefDraft,
  onCommitRemoteProfileLabel,
  onCommitRemoteHost,
  onCommitRemoteToken,
  onCommitGatewayHttpBaseUrl,
  onCommitGatewayWsBaseUrl,
  onCommitGatewayTokenRef,
  onCommitGatewayHealthcheckPath,
  onSetGatewayAuthMode,
  onToggleGatewayEnabled,
  onChangeRemoteProvider,
  onChangeTcpOverlay,
  onSelectRemoteProfile,
  onAddRemoteProfile,
  onRemoveRemoteProfile,
  onSetDefaultRemoteProfile,
  onSetDefaultExecutionBackend,
  onRefreshTailscaleStatus,
  onRefreshTailscaleCommandPreview,
  onUseSuggestedTailscaleHost,
  onRefreshNetbirdStatus,
  onRefreshNetbirdCommandPreview,
  onUseSuggestedNetbirdHost,
  onTcpDaemonStart,
  onTcpDaemonStop,
  onTcpDaemonStatus,
  onCommitOrbitWsUrl,
  onCommitOrbitAuthUrl,
  onCommitOrbitRunnerName,
  onCommitOrbitAccessClientId,
  onCommitOrbitAccessClientSecretRef,
  onToggleOrbitUseAccess,
  onOrbitConnectTest,
  onOrbitSignIn,
  onOrbitSignOut,
  onOrbitRunnerStart,
  onOrbitRunnerStop,
  onOrbitRunnerStatus,
  onMobileConnectTest,
  remoteProfilesOperability,
  transportModeOperability,
  gatewayOperability,
  tcpTransportOperability,
  orbitTransportOperability,
  backendPoolVisible,
  backendPool,
  backendPoolLoading,
  backendPoolError,
  backendPoolReadOnlyReason,
  backendPoolStateActionsEnabled,
  backendPoolRemoveEnabled,
  backendPoolUpsertEnabled,
  backendPoolProbeEnabled,
  backendPoolEditEnabled,
  backendPoolBootstrapPreview,
  backendPoolBootstrapPreviewError,
  backendPoolDiagnostics,
  backendPoolDiagnosticsError,
  onRefreshBackendPool,
  onBackendPoolAction,
  onBackendPoolUpsert,
  onNativeBackendEdit,
  onAcpBackendUpsert,
  onAcpBackendEdit,
  onAcpBackendProbe,
  workspaceOptions,
  automationSchedules,
  automationSchedulesOperability,
  automationScheduleActionAvailability,
  onRefreshAutomationSchedules,
  onCreateAutomationSchedule,
  onUpdateAutomationSchedule,
  onAutomationScheduleAction,
  onOpenMissionTarget,
}: SettingsServerSectionProps) {
  const { isMobileSimplified, tcpRunnerStatusText, activeTcpHelperLabel, activeTcpSuggestedHost } =
    buildSettingsServerSectionViewModel({
      isMobilePlatform,
      activeTcpOverlay,
      tailscaleStatus,
      netbirdStatus,
      tcpDaemonStatus,
    });

  const sectionSubtitle = isMobileSimplified
    ? "Choose TCP or Orbit, fill in the connection endpoint and token from your desktop setup, then run a connection test."
    : "Set routing intent for the control plane, then manage browser, daemon, and mobile transport separately. Mission Control and Review Pack stay bound to runtime-confirmed placement, while backend pool health only explains routing capacity and degraded state.";

  const remoteProviderHelp = isMobileSimplified
    ? "TCP uses your desktop overlay host and token. Orbit uses your Orbit websocket endpoint."
    : "Select which transport configuration to maintain for mobile access and optional desktop remote-mode testing.";

  const transportGroupSubtitle = isMobileSimplified
    ? "Choose TCP or Orbit first, then maintain only the matching connection fields below."
    : "Only needed for daemon access, mobile entrypoints, Orbit/TCP transport maintenance, or explicit desktop remote-mode testing.";

  const tcpOverlaySubtitle =
    activeTcpOverlay === "netbird"
      ? "NetBird uses the peer DNS name exposed by your mesh and keeps remote access self-hostable."
      : "Tailscale uses your tailnet DNS name and is the default overlay for desktop and mobile remote access.";

  const tcpRemoteBackendHelp = isMobileSimplified
    ? activeTcpOverlay === "netbird"
      ? "Use the NetBird peer DNS name from your desktop helper state, for example `builder.netbird.cloud:4732`."
      : "Use the Tailscale host from your desktop HugeCode app (Server section), for example `macbook.your-tailnet.ts.net:4732`."
    : "This host/token is used by mobile clients and desktop remote-mode testing.";

  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const compactSelectProps = {
    className: controlStyles.selectRoot,
    triggerClassName: controlStyles.selectTrigger,
    menuClassName: controlStyles.selectMenu,
    optionClassName: controlStyles.selectOption,
    triggerDensity: "compact" as const,
  } satisfies SettingsServerCompactSelectProps;
  const defaultExecutionBackendSelectOptions: SelectOption[] = [
    { value: "", label: "Automatic runtime routing" },
    ...remoteExecutionBackendOptions.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  ];
  const gatewayAuthModeOptions: SelectOption[] = [
    { value: "none", label: "No gateway auth" },
    { value: "token", label: "Token auth" },
  ];
  const backendModeOptions: SelectOption[] = [
    { value: "local", label: "Local (default)" },
    { value: "remote", label: "Remote (daemon)" },
  ];
  const remoteProviderOptions: SelectOption[] = [
    { value: "tcp", label: isMobileSimplified ? "TCP" : "TCP (wip)" },
    { value: "orbit", label: isMobileSimplified ? "Orbit" : "Orbit (wip)" },
  ];
  const tcpOverlayOptions: SelectOption[] = [
    { value: "tailscale", label: "Tailscale" },
    { value: "netbird", label: "NetBird" },
  ];

  return (
    <SettingsSectionFrame title="Execution routing & transport" subtitle={sectionSubtitle}>
      {!isMobileSimplified && (
        <SettingsFieldGroup
          title="Execution routing defaults"
          subtitle="Choose the default backend route first. Transport and daemon controls stay below as advanced maintenance settings, and backend pool status remains observability rather than execution truth."
        >
          {remoteExecutionBackendOptions.length > 0 ? (
            <SettingsField
              label="Default execution backend"
              help="This backend is applied by the application runtime facade whenever a task starts without an explicit backend preference. It sets routing intent, not confirmed placement truth; Mission Control and Review show the runtime-resolved backend, source, and routing health for each run."
            >
              <Select
                {...compactSelectProps}
                ariaLabel="Default execution backend"
                options={defaultExecutionBackendSelectOptions}
                value={defaultRemoteExecutionBackendId ?? ""}
                onValueChange={(value) => {
                  void onSetDefaultExecutionBackend(value || null);
                }}
              />
            </SettingsField>
          ) : null}
        </SettingsFieldGroup>
      )}

      {!isMobileSimplified && backendPoolVisible ? (
        <SettingsFieldGroup
          title="Backend pool state"
          subtitle="Observe backend health, onboarding, and diagnostics here. This explains routing capacity, degraded state, and self-host next steps without replacing runtime-confirmed placement."
        >
          <SettingsBackendPoolSection
            backendPool={backendPool}
            loading={backendPoolLoading}
            error={backendPoolError}
            readOnlyReason={backendPoolReadOnlyReason}
            stateActionsEnabled={backendPoolStateActionsEnabled}
            removeEnabled={backendPoolRemoveEnabled}
            upsertEnabled={backendPoolUpsertEnabled}
            probeEnabled={backendPoolProbeEnabled}
            editEnabled={backendPoolEditEnabled}
            bootstrapPreview={backendPoolBootstrapPreview}
            bootstrapPreviewError={backendPoolBootstrapPreviewError}
            diagnostics={backendPoolDiagnostics}
            diagnosticsError={backendPoolDiagnosticsError}
            showFieldGroup={false}
            onRefresh={onRefreshBackendPool}
            onBackendAction={onBackendPoolAction}
            onBackendUpsert={onBackendPoolUpsert}
            onNativeBackendEdit={onNativeBackendEdit}
            onAcpBackendUpsert={onAcpBackendUpsert}
            onAcpBackendEdit={onAcpBackendEdit}
            onAcpBackendProbe={onAcpBackendProbe}
          />
        </SettingsFieldGroup>
      ) : null}

      {!isMobileSimplified ? (
        <SettingsAutomationSection
          backendOptions={remoteExecutionBackendOptions}
          workspaceOptions={workspaceOptions}
          defaultBackendId={defaultRemoteExecutionBackendId}
          schedules={automationSchedules}
          operability={automationSchedulesOperability}
          actionAvailability={automationScheduleActionAvailability}
          onRefreshSchedules={onRefreshAutomationSchedules}
          onCreateSchedule={onCreateAutomationSchedule}
          onUpdateSchedule={onUpdateAutomationSchedule}
          onScheduleAction={onAutomationScheduleAction}
          onOpenMissionTarget={onOpenMissionTarget}
        />
      ) : null}

      <SettingsRemoteProfilesFieldGroup
        isMobileSimplified={isMobileSimplified}
        remoteProfiles={remoteProfiles}
        selectedRemoteProfileId={selectedRemoteProfileId}
        defaultRemoteProfileId={defaultRemoteProfileId}
        remoteProfileLabelDraft={remoteProfileLabelDraft}
        compactInputFieldClassName={compactInputFieldClassName}
        operability={remoteProfilesOperability}
        onSelectRemoteProfile={onSelectRemoteProfile}
        onAddRemoteProfile={onAddRemoteProfile}
        onSetDefaultRemoteProfile={onSetDefaultRemoteProfile}
        onRemoveRemoteProfile={onRemoveRemoteProfile}
        onSetRemoteProfileLabelDraft={onSetRemoteProfileLabelDraft}
        onCommitRemoteProfileLabel={onCommitRemoteProfileLabel}
      />

      <SettingsWebRuntimeGatewayFieldGroup
        isMobileSimplified={isMobileSimplified}
        gatewayEnabled={gatewayEnabled}
        gatewayHttpBaseUrlDraft={gatewayHttpBaseUrlDraft}
        gatewayWsBaseUrlDraft={gatewayWsBaseUrlDraft}
        gatewayTokenRefDraft={gatewayTokenRefDraft}
        gatewayHealthcheckPathDraft={gatewayHealthcheckPathDraft}
        activeGatewayAuthMode={activeGatewayAuthMode}
        compactInputFieldClassName={compactInputFieldClassName}
        compactSelectProps={compactSelectProps}
        gatewayAuthModeOptions={gatewayAuthModeOptions}
        operability={gatewayOperability}
        onSetGatewayHttpBaseUrlDraft={onSetGatewayHttpBaseUrlDraft}
        onSetGatewayWsBaseUrlDraft={onSetGatewayWsBaseUrlDraft}
        onSetGatewayTokenRefDraft={onSetGatewayTokenRefDraft}
        onSetGatewayHealthcheckPathDraft={onSetGatewayHealthcheckPathDraft}
        onCommitGatewayHttpBaseUrl={onCommitGatewayHttpBaseUrl}
        onCommitGatewayWsBaseUrl={onCommitGatewayWsBaseUrl}
        onCommitGatewayTokenRef={onCommitGatewayTokenRef}
        onCommitGatewayHealthcheckPath={onCommitGatewayHealthcheckPath}
        onSetGatewayAuthMode={onSetGatewayAuthMode}
        onToggleGatewayEnabled={onToggleGatewayEnabled}
      />

      <SettingsTransportModeFieldGroup
        appSettings={appSettings}
        isMobileSimplified={isMobileSimplified}
        transportGroupSubtitle={transportGroupSubtitle}
        remoteProviderHelp={remoteProviderHelp}
        activeRemoteProvider={activeRemoteProvider}
        compactSelectProps={compactSelectProps}
        backendModeOptions={backendModeOptions}
        remoteProviderOptions={remoteProviderOptions}
        operability={transportModeOperability}
        onUpdateAppSettings={onUpdateAppSettings}
        onChangeRemoteProvider={onChangeRemoteProvider}
      />

      <SettingsTcpTransportSections
        activeRemoteProvider={activeRemoteProvider}
        activeTcpOverlay={activeTcpOverlay}
        isMobileSimplified={isMobileSimplified}
        tcpOverlaySubtitle={tcpOverlaySubtitle}
        tcpRemoteBackendHelp={tcpRemoteBackendHelp}
        activeTcpHelperLabel={activeTcpHelperLabel}
        activeTcpSuggestedHost={activeTcpSuggestedHost}
        compactInputFieldClassName={compactInputFieldClassName}
        compactSelectProps={compactSelectProps}
        tcpOverlayOptions={tcpOverlayOptions}
        operability={tcpTransportOperability}
        remoteHostDraft={remoteHostDraft}
        remoteTokenDraft={remoteTokenDraft}
        mobileConnectBusy={mobileConnectBusy}
        mobileConnectStatusText={mobileConnectStatusText}
        mobileConnectStatusError={mobileConnectStatusError}
        tcpDaemonStatus={tcpDaemonStatus}
        tcpDaemonBusyAction={tcpDaemonBusyAction}
        tcpRunnerStatusText={tcpRunnerStatusText}
        tailscaleStatus={tailscaleStatus}
        tailscaleStatusBusy={tailscaleStatusBusy}
        tailscaleStatusError={tailscaleStatusError}
        tailscaleCommandPreview={tailscaleCommandPreview}
        tailscaleCommandBusy={tailscaleCommandBusy}
        tailscaleCommandError={tailscaleCommandError}
        netbirdStatus={netbirdStatus}
        netbirdStatusBusy={netbirdStatusBusy}
        netbirdStatusError={netbirdStatusError}
        netbirdCommandPreview={netbirdCommandPreview}
        netbirdCommandBusy={netbirdCommandBusy}
        netbirdCommandError={netbirdCommandError}
        onSetRemoteHostDraft={onSetRemoteHostDraft}
        onSetRemoteTokenDraft={onSetRemoteTokenDraft}
        onCommitRemoteHost={onCommitRemoteHost}
        onCommitRemoteToken={onCommitRemoteToken}
        onChangeTcpOverlay={onChangeTcpOverlay}
        onMobileConnectTest={onMobileConnectTest}
        onTcpDaemonStart={onTcpDaemonStart}
        onTcpDaemonStop={onTcpDaemonStop}
        onTcpDaemonStatus={onTcpDaemonStatus}
        onRefreshTailscaleStatus={onRefreshTailscaleStatus}
        onRefreshTailscaleCommandPreview={onRefreshTailscaleCommandPreview}
        onUseSuggestedTailscaleHost={onUseSuggestedTailscaleHost}
        onRefreshNetbirdStatus={onRefreshNetbirdStatus}
        onRefreshNetbirdCommandPreview={onRefreshNetbirdCommandPreview}
        onUseSuggestedNetbirdHost={onUseSuggestedNetbirdHost}
      />

      <SettingsOrbitTransportSections
        appSettings={appSettings}
        activeRemoteProvider={activeRemoteProvider}
        isMobileSimplified={isMobileSimplified}
        activeOrbitUseAccess={activeOrbitUseAccess}
        compactInputFieldClassName={compactInputFieldClassName}
        operability={orbitTransportOperability}
        orbitWsUrlDraft={orbitWsUrlDraft}
        orbitAuthUrlDraft={orbitAuthUrlDraft}
        orbitRunnerNameDraft={orbitRunnerNameDraft}
        orbitAccessClientIdDraft={orbitAccessClientIdDraft}
        orbitAccessClientSecretRefDraft={orbitAccessClientSecretRefDraft}
        remoteTokenDraft={remoteTokenDraft}
        orbitStatusText={orbitStatusText}
        orbitAuthCode={orbitAuthCode}
        orbitVerificationUrl={orbitVerificationUrl}
        orbitBusyAction={orbitBusyAction}
        mobileConnectBusy={mobileConnectBusy}
        mobileConnectStatusText={mobileConnectStatusText}
        mobileConnectStatusError={mobileConnectStatusError}
        onUpdateAppSettings={onUpdateAppSettings}
        onSetOrbitWsUrlDraft={onSetOrbitWsUrlDraft}
        onSetOrbitAuthUrlDraft={onSetOrbitAuthUrlDraft}
        onSetOrbitRunnerNameDraft={onSetOrbitRunnerNameDraft}
        onSetOrbitAccessClientIdDraft={onSetOrbitAccessClientIdDraft}
        onSetOrbitAccessClientSecretRefDraft={onSetOrbitAccessClientSecretRefDraft}
        onSetRemoteTokenDraft={onSetRemoteTokenDraft}
        onCommitOrbitWsUrl={onCommitOrbitWsUrl}
        onCommitOrbitAuthUrl={onCommitOrbitAuthUrl}
        onCommitOrbitRunnerName={onCommitOrbitRunnerName}
        onCommitOrbitAccessClientId={onCommitOrbitAccessClientId}
        onCommitOrbitAccessClientSecretRef={onCommitOrbitAccessClientSecretRef}
        onCommitRemoteToken={onCommitRemoteToken}
        onToggleOrbitUseAccess={onToggleOrbitUseAccess}
        onOrbitConnectTest={onOrbitConnectTest}
        onOrbitSignIn={onOrbitSignIn}
        onOrbitSignOut={onOrbitSignOut}
        onOrbitRunnerStart={onOrbitRunnerStart}
        onOrbitRunnerStop={onOrbitRunnerStop}
        onOrbitRunnerStatus={onOrbitRunnerStatus}
        onMobileConnectTest={onMobileConnectTest}
      />

      <div className="settings-help">
        {isMobileSimplified
          ? activeRemoteProvider === "tcp"
            ? "Use your own infrastructure only. On iOS, get the Tailscale hostname and token from your desktop CodexMonitor setup."
            : "Use your own infrastructure only. On iOS, use the Orbit websocket URL and token configured on your desktop CodexMonitor setup."
          : "Mobile access should stay scoped to your own infrastructure (tailnet or self-hosted Orbit). CodexMonitor does not provide hosted backend services."}
      </div>
    </SettingsSectionFrame>
  );
}
