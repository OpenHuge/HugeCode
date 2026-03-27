import type { Dispatch, SetStateAction } from "react";
import { Button, Input, Select, StatusBadge, type SelectOption } from "../../../../design-system";
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
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import { SettingsToggleControl } from "../SettingsToggleControl";
import {
  SettingsAutomationSection,
  type SettingsAutomationScheduleAction,
  type SettingsAutomationScheduleDraft,
  type SettingsAutomationScheduleSummary,
} from "./SettingsAutomationSection";
import type { BackendPoolSnapshot } from "../../types/backendPool";
import { buildSettingsServerSectionViewModel } from "./settingsServerSectionViewModel";
import { SettingsBackendPoolSection } from "./SettingsBackendPoolSection";

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
  automationSchedulesLoading?: boolean;
  automationSchedulesError?: string | null;
  automationSchedulesReadOnlyReason?: string | null;
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
  automationSchedulesLoading,
  automationSchedulesError,
  automationSchedulesReadOnlyReason,
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
  };
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
          loading={automationSchedulesLoading}
          error={automationSchedulesError}
          readOnlyReason={automationSchedulesReadOnlyReason}
          onRefreshSchedules={onRefreshAutomationSchedules}
          onCreateSchedule={onCreateAutomationSchedule}
          onUpdateSchedule={onUpdateAutomationSchedule}
          onScheduleAction={onAutomationScheduleAction}
          onOpenMissionTarget={onOpenMissionTarget}
        />
      ) : null}

      {!isMobileSimplified && (
        <SettingsFieldGroup
          title="Remote backend profiles"
          subtitle="Manage reusable profile records separately from transport-specific daemon and mobile connection settings."
        >
          <SettingsField
            label="Profile list"
            help="The default profile keeps legacy desktop/mobile settings in sync."
          >
            <div className="settings-field">
              <SettingsFooterBar>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="settings-button-compact"
                  onClick={() => {
                    void onAddRemoteProfile();
                  }}
                >
                  Add profile
                </Button>
              </SettingsFooterBar>
              <div className="settings-field-row" role="list" aria-label="Remote backend profiles">
                {remoteProfiles.map((profile) => {
                  const isSelected = profile.id === selectedRemoteProfileId;
                  const isDefault = profile.id === defaultRemoteProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      className={`settings-profile-button${isSelected ? " is-selected" : ""}`}
                      onClick={() => onSelectRemoteProfile(profile.id)}
                      aria-pressed={isSelected}
                    >
                      <StatusBadge className="settings-profile-badge">{profile.label}</StatusBadge>
                      {isDefault ? (
                        <StatusBadge className="settings-profile-default-badge" tone="progress">
                          Default
                        </StatusBadge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {selectedRemoteProfileId ? (
                <SettingsFooterBar>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={() => {
                      void onSetDefaultRemoteProfile(selectedRemoteProfileId);
                    }}
                    disabled={selectedRemoteProfileId === defaultRemoteProfileId}
                  >
                    Set default profile
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={() => {
                      void onRemoveRemoteProfile(selectedRemoteProfileId);
                    }}
                    disabled={remoteProfiles.length <= 1}
                  >
                    Remove profile
                  </Button>
                </SettingsFooterBar>
              ) : null}
            </div>
          </SettingsField>

          <SettingsField label="Profile name" htmlFor="remote-profile-label">
            <Input
              id="remote-profile-label"
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={remoteProfileLabelDraft}
              placeholder="Remote backend profile name"
              onValueChange={onSetRemoteProfileLabelDraft}
              onBlur={() => {
                void onCommitRemoteProfileLabel();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onCommitRemoteProfileLabel();
                }
              }}
              aria-label="Remote backend profile name"
            />
          </SettingsField>
        </SettingsFieldGroup>
      )}

      {!isMobileSimplified && (
        <SettingsFieldGroup
          title="Web runtime gateway"
          subtitle="Browser RPC and websocket transport for the selected profile. This is separate from mobile or daemon transport configuration."
        >
          <SettingsField
            label="Gateway settings"
            help="When enabled, browser runtime transport uses this profile's gateway settings before falling back to env configuration."
          >
            <div className="settings-field">
              <SettingsControlRow
                title="Enable settings-backed gateway"
                subtitle="Controls browser runtime RPC and websocket routing for the selected profile."
                control={
                  <SettingsToggleControl
                    checked={gatewayEnabled}
                    ariaLabel="Toggle gateway enabled"
                    onCheckedChange={() => {
                      void onToggleGatewayEnabled();
                    }}
                  />
                }
              />
              <div className="settings-field-row">
                <Input
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={gatewayHttpBaseUrlDraft}
                  placeholder="https://runtime.example.dev/rpc"
                  onValueChange={onSetGatewayHttpBaseUrlDraft}
                  onBlur={() => {
                    void onCommitGatewayHttpBaseUrl();
                  }}
                />
                <Input
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={gatewayWsBaseUrlDraft}
                  placeholder="wss://runtime.example.dev/ws"
                  onValueChange={onSetGatewayWsBaseUrlDraft}
                  onBlur={() => {
                    void onCommitGatewayWsBaseUrl();
                  }}
                />
              </div>
              <div className="settings-field-row">
                <Select
                  {...compactSelectProps}
                  ariaLabel="Gateway auth mode"
                  options={gatewayAuthModeOptions}
                  value={activeGatewayAuthMode}
                  onValueChange={(value) => {
                    void onSetGatewayAuthMode(value as "none" | "token");
                  }}
                />
                <Input
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={gatewayTokenRefDraft}
                  placeholder="Gateway token ref"
                  onValueChange={onSetGatewayTokenRefDraft}
                  onBlur={() => {
                    void onCommitGatewayTokenRef();
                  }}
                />
                <Input
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={gatewayHealthcheckPathDraft}
                  placeholder="/health"
                  onValueChange={onSetGatewayHealthcheckPathDraft}
                  onBlur={() => {
                    void onCommitGatewayHealthcheckPath();
                  }}
                />
              </div>
            </div>
          </SettingsField>
        </SettingsFieldGroup>
      )}

      <SettingsFieldGroup
        title={
          isMobileSimplified ? "Connection type" : "Desktop and mobile transport details (Advanced)"
        }
        subtitle={transportGroupSubtitle}
      >
        {!isMobileSimplified ? (
          <SettingsField
            label="Backend mode"
            help="Local keeps desktop requests in-process. Remote routes desktop requests through the same network transport path used by mobile clients."
          >
            <Select
              {...compactSelectProps}
              ariaLabel="Backend mode"
              options={backendModeOptions}
              value={appSettings.backendMode}
              onValueChange={(value) =>
                void onUpdateAppSettings({
                  ...appSettings,
                  backendMode: value as AppSettings["backendMode"],
                })
              }
            />
          </SettingsField>
        ) : null}

        <SettingsField
          label={isMobileSimplified ? "Connection type" : "Remote provider"}
          help={remoteProviderHelp}
        >
          <Select
            {...compactSelectProps}
            ariaLabel={isMobileSimplified ? "Connection type" : "Remote provider"}
            options={remoteProviderOptions}
            value={activeRemoteProvider}
            onValueChange={(value) => {
              void onChangeRemoteProvider(value as RemoteBackendProvider);
            }}
          />
        </SettingsField>

        {!isMobileSimplified ? (
          <SettingsControlRow
            title="Keep daemon running after app closes"
            subtitle="If disabled, CodexMonitor stops managed TCP and Orbit daemon processes before exit."
            control={
              <SettingsToggleControl
                checked={appSettings.keepDaemonRunningAfterAppClose}
                ariaLabel="Toggle keep daemon running after app closes"
                onCheckedChange={() =>
                  void onUpdateAppSettings({
                    ...appSettings,
                    keepDaemonRunningAfterAppClose: !appSettings.keepDaemonRunningAfterAppClose,
                  })
                }
              />
            }
          />
        ) : null}
      </SettingsFieldGroup>

      {activeRemoteProvider === "tcp" ? (
        <>
          <SettingsFieldGroup title="TCP overlay" subtitle={tcpOverlaySubtitle}>
            <SettingsField label="TCP overlay">
              <Select
                {...compactSelectProps}
                ariaLabel="TCP overlay"
                options={tcpOverlayOptions}
                value={activeTcpOverlay}
                onValueChange={(value) => {
                  void onChangeTcpOverlay(value as RemoteTcpOverlay);
                }}
              />
            </SettingsField>
          </SettingsFieldGroup>

          <SettingsFieldGroup title="Remote backend" subtitle={tcpRemoteBackendHelp}>
            <SettingsField label="Remote backend connection">
              <div className="settings-field-row">
                <Input
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={remoteHostDraft}
                  placeholder="127.0.0.1:4732"
                  onValueChange={onSetRemoteHostDraft}
                  onBlur={() => {
                    void onCommitRemoteHost();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void onCommitRemoteHost();
                    }
                  }}
                  aria-label="Remote backend host"
                />
                <Input
                  type="password"
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={remoteTokenDraft}
                  placeholder="Token (required)"
                  onValueChange={onSetRemoteTokenDraft}
                  onBlur={() => {
                    void onCommitRemoteToken();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void onCommitRemoteToken();
                    }
                  }}
                  aria-label="Remote backend token"
                />
              </div>
            </SettingsField>
          </SettingsFieldGroup>

          {isMobileSimplified ? (
            <SettingsFieldGroup
              title="Connection test"
              subtitle="Make sure your desktop app daemon is running and reachable on the selected TCP overlay, then retry this test."
            >
              <SettingsField label="Connection test">
                <div className="settings-field">
                  <div className="settings-field-row">
                    <Button
                      variant="primary"
                      size="sm"
                      className="settings-button-compact"
                      onClick={onMobileConnectTest}
                      disabled={mobileConnectBusy}
                    >
                      {mobileConnectBusy ? "Connecting..." : "Connect & test"}
                    </Button>
                  </div>
                  {mobileConnectStatusText ? (
                    <div
                      className={`settings-help${mobileConnectStatusError ? " settings-help-error" : ""}`}
                    >
                      {mobileConnectStatusText}
                    </div>
                  ) : null}
                </div>
              </SettingsField>
            </SettingsFieldGroup>
          ) : (
            <>
              <SettingsFieldGroup
                title="Mobile access daemon"
                subtitle="Start this daemon before connecting from iOS. It uses your current token and listens on 0.0.0.0:<port>, matching your configured host port."
              >
                <SettingsField label="Daemon controls">
                  <div className="settings-field">
                    <div className="settings-field-row">
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={() => {
                          void onTcpDaemonStart();
                        }}
                        disabled={tcpDaemonBusyAction !== null}
                      >
                        {tcpDaemonBusyAction === "start" ? "Starting..." : "Start daemon"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={() => {
                          void onTcpDaemonStop();
                        }}
                        disabled={tcpDaemonBusyAction !== null}
                      >
                        {tcpDaemonBusyAction === "stop" ? "Stopping..." : "Stop daemon"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={() => {
                          void onTcpDaemonStatus();
                        }}
                        disabled={tcpDaemonBusyAction !== null}
                      >
                        {tcpDaemonBusyAction === "status" ? "Refreshing..." : "Refresh status"}
                      </Button>
                    </div>
                    {tcpRunnerStatusText ? (
                      <div className="settings-help">{tcpRunnerStatusText}</div>
                    ) : null}
                    {tcpDaemonStatus?.startedAtMs ? (
                      <div className="settings-help">
                        Started at: {new Date(tcpDaemonStatus.startedAtMs).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </SettingsField>
              </SettingsFieldGroup>

              <SettingsFieldGroup title={activeTcpHelperLabel}>
                <SettingsField label={`${activeTcpHelperLabel} tools`}>
                  <div className="settings-field">
                    {activeTcpOverlay === "netbird" ? (
                      <>
                        <div className="settings-field-row">
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            onClick={onRefreshNetbirdStatus}
                            disabled={netbirdStatusBusy}
                          >
                            {netbirdStatusBusy ? "Checking..." : "Detect NetBird"}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            onClick={onRefreshNetbirdCommandPreview}
                            disabled={netbirdCommandBusy}
                          >
                            {netbirdCommandBusy ? "Refreshing..." : "Refresh setup command"}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            disabled={!activeTcpSuggestedHost}
                            onClick={() => {
                              void onUseSuggestedNetbirdHost();
                            }}
                          >
                            Use suggested host
                          </Button>
                        </div>
                        {netbirdStatusError ? (
                          <div className="settings-help settings-help-error">
                            {netbirdStatusError}
                          </div>
                        ) : null}
                        {netbirdStatus ? (
                          <>
                            <div className="settings-help">{netbirdStatus.message}</div>
                            <div className="settings-help">
                              {netbirdStatus.installed
                                ? `Version: ${netbirdStatus.version ?? "unknown"}`
                                : "Install NetBird on both peers before using the TCP remote backend."}
                            </div>
                            {netbirdStatus.suggestedRemoteHost ? (
                              <div className="settings-help">
                                Suggested remote host:{" "}
                                <code>{netbirdStatus.suggestedRemoteHost}</code>
                              </div>
                            ) : null}
                            {netbirdStatus.managementUrl ? (
                              <div className="settings-help">
                                Management URL: <code>{netbirdStatus.managementUrl}</code>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {netbirdCommandError ? (
                          <div className="settings-help settings-help-error">
                            {netbirdCommandError}
                          </div>
                        ) : null}
                        {netbirdCommandPreview ? (
                          <>
                            <div className="settings-help">
                              Command template (manual fallback) for preparing the overlay:
                            </div>
                            <pre className="settings-command-preview">
                              <code>{netbirdCommandPreview.command}</code>
                            </pre>
                            {!netbirdCommandPreview.tokenConfigured ? (
                              <div className="settings-help settings-help-error">
                                Remote backend token is empty. Set one before exposing daemon
                                access.
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="settings-field-row">
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            onClick={onRefreshTailscaleStatus}
                            disabled={tailscaleStatusBusy}
                          >
                            {tailscaleStatusBusy ? "Checking..." : "Detect Tailscale"}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            onClick={onRefreshTailscaleCommandPreview}
                            disabled={tailscaleCommandBusy}
                          >
                            {tailscaleCommandBusy ? "Refreshing..." : "Refresh daemon command"}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="settings-button-compact"
                            disabled={!activeTcpSuggestedHost}
                            onClick={() => {
                              void onUseSuggestedTailscaleHost();
                            }}
                          >
                            Use suggested host
                          </Button>
                        </div>
                        {tailscaleStatusError ? (
                          <div className="settings-help settings-help-error">
                            {tailscaleStatusError}
                          </div>
                        ) : null}
                        {tailscaleStatus ? (
                          <>
                            <div className="settings-help">{tailscaleStatus.message}</div>
                            <div className="settings-help">
                              {tailscaleStatus.installed
                                ? `Version: ${tailscaleStatus.version ?? "unknown"}`
                                : "Install Tailscale on both desktop and iOS to continue."}
                            </div>
                            {tailscaleStatus.suggestedRemoteHost ? (
                              <div className="settings-help">
                                Suggested remote host:{" "}
                                <code>{tailscaleStatus.suggestedRemoteHost}</code>
                              </div>
                            ) : null}
                            {tailscaleStatus.tailnetName ? (
                              <div className="settings-help">
                                Tailnet: <code>{tailscaleStatus.tailnetName}</code>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {tailscaleCommandError ? (
                          <div className="settings-help settings-help-error">
                            {tailscaleCommandError}
                          </div>
                        ) : null}
                        {tailscaleCommandPreview ? (
                          <>
                            <div className="settings-help">
                              Command template (manual fallback) for starting the daemon:
                            </div>
                            <pre className="settings-command-preview">
                              <code>{tailscaleCommandPreview.command}</code>
                            </pre>
                            {!tailscaleCommandPreview.tokenConfigured ? (
                              <div className="settings-help settings-help-error">
                                Remote backend token is empty. Set one before exposing daemon
                                access.
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                </SettingsField>
              </SettingsFieldGroup>
            </>
          )}
        </>
      ) : null}

      {activeRemoteProvider === "orbit" ? (
        <>
          <SettingsFieldGroup
            title="Orbit endpoints"
            subtitle={
              isMobileSimplified
                ? "Use the same Orbit endpoint and token configured on your desktop setup."
                : "Maintain websocket and auth endpoints for the selected Orbit profile."
            }
          >
            <SettingsField label="Orbit websocket URL" htmlFor="orbit-ws-url">
              <Input
                id="orbit-ws-url"
                fieldClassName={compactInputFieldClassName}
                inputSize="sm"
                value={orbitWsUrlDraft}
                placeholder="wss://..."
                onValueChange={onSetOrbitWsUrlDraft}
                onBlur={() => {
                  void onCommitOrbitWsUrl();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCommitOrbitWsUrl();
                  }
                }}
                aria-label="Orbit websocket URL"
              />
            </SettingsField>

            {isMobileSimplified ? (
              <SettingsField
                label="Remote backend token"
                htmlFor="orbit-token-mobile"
                help="Use the same token configured on your desktop Orbit daemon setup."
              >
                <Input
                  id="orbit-token-mobile"
                  type="password"
                  fieldClassName={compactInputFieldClassName}
                  inputSize="sm"
                  value={remoteTokenDraft}
                  placeholder="Token (required)"
                  onValueChange={onSetRemoteTokenDraft}
                  onBlur={() => {
                    void onCommitRemoteToken();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void onCommitRemoteToken();
                    }
                  }}
                  aria-label="Remote backend token"
                />
              </SettingsField>
            ) : (
              <>
                <SettingsField label="Orbit auth URL" htmlFor="orbit-auth-url">
                  <Input
                    id="orbit-auth-url"
                    fieldClassName={compactInputFieldClassName}
                    inputSize="sm"
                    value={orbitAuthUrlDraft}
                    placeholder="https://..."
                    onValueChange={onSetOrbitAuthUrlDraft}
                    onBlur={() => {
                      void onCommitOrbitAuthUrl();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onCommitOrbitAuthUrl();
                      }
                    }}
                    aria-label="Orbit auth URL"
                  />
                </SettingsField>

                <SettingsField label="Orbit runner name" htmlFor="orbit-runner-name">
                  <Input
                    id="orbit-runner-name"
                    fieldClassName={compactInputFieldClassName}
                    inputSize="sm"
                    value={orbitRunnerNameDraft}
                    placeholder="codex-monitor"
                    onValueChange={onSetOrbitRunnerNameDraft}
                    onBlur={() => {
                      void onCommitOrbitRunnerName();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onCommitOrbitRunnerName();
                      }
                    }}
                    aria-label="Orbit runner name"
                  />
                </SettingsField>
              </>
            )}
          </SettingsFieldGroup>

          {isMobileSimplified ? (
            <SettingsFieldGroup
              title="Connection test"
              subtitle="Make sure the Orbit endpoint and token match your desktop setup, then retry."
            >
              <SettingsField label="Connection test">
                <div className="settings-field">
                  <div className="settings-field-row">
                    <Button
                      variant="primary"
                      size="sm"
                      className="settings-button-compact"
                      onClick={onMobileConnectTest}
                      disabled={mobileConnectBusy}
                    >
                      {mobileConnectBusy ? "Connecting..." : "Connect & test"}
                    </Button>
                  </div>
                  {mobileConnectStatusText ? (
                    <div
                      className={`settings-help${mobileConnectStatusError ? " settings-help-error" : ""}`}
                    >
                      {mobileConnectStatusText}
                    </div>
                  ) : null}
                </div>
              </SettingsField>
            </SettingsFieldGroup>
          ) : (
            <>
              <SettingsFieldGroup
                title="Orbit access"
                subtitle="Enable OAuth client credentials and runner startup preferences for Orbit."
              >
                <SettingsControlRow
                  title="Auto start runner"
                  subtitle="Start the Orbit runner automatically when remote mode activates."
                  control={
                    <SettingsToggleControl
                      checked={appSettings.orbitAutoStartRunner}
                      ariaLabel="Toggle Orbit auto start runner"
                      onCheckedChange={() =>
                        void onUpdateAppSettings({
                          ...appSettings,
                          orbitAutoStartRunner: !appSettings.orbitAutoStartRunner,
                        })
                      }
                    />
                  }
                />
                <SettingsControlRow
                  title="Use Orbit Access"
                  subtitle="Enable OAuth client credentials for Orbit Access."
                  control={
                    <SettingsToggleControl
                      checked={activeOrbitUseAccess}
                      ariaLabel="Toggle Orbit Access"
                      onCheckedChange={() => {
                        void onToggleOrbitUseAccess();
                      }}
                    />
                  }
                />
                <SettingsField label="Orbit access client ID" htmlFor="orbit-access-client-id">
                  <Input
                    id="orbit-access-client-id"
                    fieldClassName={compactInputFieldClassName}
                    inputSize="sm"
                    value={orbitAccessClientIdDraft}
                    placeholder="client-id"
                    disabled={!activeOrbitUseAccess}
                    onValueChange={onSetOrbitAccessClientIdDraft}
                    onBlur={() => {
                      void onCommitOrbitAccessClientId();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onCommitOrbitAccessClientId();
                      }
                    }}
                    aria-label="Orbit access client ID"
                  />
                </SettingsField>
                <SettingsField
                  label="Orbit access client secret ref"
                  htmlFor="orbit-access-client-secret-ref"
                >
                  <Input
                    id="orbit-access-client-secret-ref"
                    fieldClassName={compactInputFieldClassName}
                    inputSize="sm"
                    value={orbitAccessClientSecretRefDraft}
                    placeholder="secret-ref"
                    disabled={!activeOrbitUseAccess}
                    onValueChange={onSetOrbitAccessClientSecretRefDraft}
                    onBlur={() => {
                      void onCommitOrbitAccessClientSecretRef();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onCommitOrbitAccessClientSecretRef();
                      }
                    }}
                    aria-label="Orbit access client secret ref"
                  />
                </SettingsField>
              </SettingsFieldGroup>

              <SettingsFieldGroup
                title="Orbit actions"
                subtitle="Run connection and runner controls for the selected Orbit profile."
              >
                <SettingsField label="Orbit actions">
                  <div className="settings-field">
                    <div className="settings-field-row">
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitConnectTest}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "connect-test" ? "Testing..." : "Connect test"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitSignIn}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "sign-in" ? "Signing In..." : "Sign In"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitSignOut}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "sign-out" ? "Signing Out..." : "Sign Out"}
                      </Button>
                    </div>
                    <div className="settings-field-row">
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitRunnerStart}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "runner-start" ? "Starting..." : "Start Runner"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitRunnerStop}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "runner-stop" ? "Stopping..." : "Stop Runner"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onOrbitRunnerStatus}
                        disabled={orbitBusyAction !== null}
                      >
                        {orbitBusyAction === "runner-status" ? "Refreshing..." : "Refresh Status"}
                      </Button>
                    </div>
                    {orbitStatusText ? (
                      <div className="settings-help">{orbitStatusText}</div>
                    ) : null}
                    {orbitAuthCode ? (
                      <div className="settings-help">
                        Auth code: <code>{orbitAuthCode}</code>
                      </div>
                    ) : null}
                    {orbitVerificationUrl ? (
                      <div className="settings-help">
                        Verification URL:{" "}
                        <a href={orbitVerificationUrl} target="_blank" rel="noreferrer">
                          {orbitVerificationUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </SettingsField>
              </SettingsFieldGroup>
            </>
          )}
        </>
      ) : null}

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
