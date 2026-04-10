import type { Dispatch, SetStateAction } from "react";
import {
  resolveSettingsServerOperabilityBlockedReason,
  resolveSettingsServerOperabilityNotice,
  type SettingsServerCompactSelectProps,
  type SettingsServerOperabilityState,
} from "@ku0/code-workspace-client/settings-shell";
import { Button, Input, Select, type SelectOption } from "../../../../../design-system";
import type {
  NetbirdDaemonCommandPreview,
  NetbirdStatus,
  RemoteBackendProvider,
  RemoteTcpOverlay,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "../../../../../types";
import { SettingsField, SettingsFieldGroup } from "../../SettingsSectionGrammar";
import { SettingsMobileConnectFieldGroup } from "./SettingsMobileConnectFieldGroup";

type SettingsTcpTransportSectionsProps = {
  activeRemoteProvider: RemoteBackendProvider;
  activeTcpOverlay: RemoteTcpOverlay;
  isMobileSimplified: boolean;
  tcpOverlaySubtitle: string;
  tcpRemoteBackendHelp: string;
  activeTcpHelperLabel: string;
  activeTcpSuggestedHost: string | null;
  compactInputFieldClassName: string;
  compactSelectProps: SettingsServerCompactSelectProps;
  tcpOverlayOptions: SelectOption[];
  operability: SettingsServerOperabilityState;
  remoteHostDraft: string;
  remoteTokenDraft: string;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  tcpDaemonStatus: TcpDaemonStatus | null;
  tcpDaemonBusyAction: "start" | "stop" | "status" | null;
  tcpRunnerStatusText: string | null;
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
  onSetRemoteHostDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteHost: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onChangeTcpOverlay: (tcpOverlay: RemoteTcpOverlay) => Promise<void>;
  onMobileConnectTest: () => void;
  onTcpDaemonStart: () => Promise<void>;
  onTcpDaemonStop: () => Promise<void>;
  onTcpDaemonStatus: () => Promise<void>;
  onRefreshTailscaleStatus: () => void;
  onRefreshTailscaleCommandPreview: () => void;
  onUseSuggestedTailscaleHost: () => Promise<void>;
  onRefreshNetbirdStatus: () => void;
  onRefreshNetbirdCommandPreview: () => void;
  onUseSuggestedNetbirdHost: () => Promise<void>;
};

export function SettingsTcpTransportSections({
  activeRemoteProvider,
  activeTcpOverlay,
  isMobileSimplified,
  tcpOverlaySubtitle,
  tcpRemoteBackendHelp,
  activeTcpHelperLabel,
  activeTcpSuggestedHost,
  compactInputFieldClassName,
  compactSelectProps,
  tcpOverlayOptions,
  operability,
  remoteHostDraft,
  remoteTokenDraft,
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
  tcpDaemonStatus,
  tcpDaemonBusyAction,
  tcpRunnerStatusText,
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
  onSetRemoteHostDraft,
  onSetRemoteTokenDraft,
  onCommitRemoteHost,
  onCommitRemoteToken,
  onChangeTcpOverlay,
  onMobileConnectTest,
  onTcpDaemonStart,
  onTcpDaemonStop,
  onTcpDaemonStatus,
  onRefreshTailscaleStatus,
  onRefreshTailscaleCommandPreview,
  onUseSuggestedTailscaleHost,
  onRefreshNetbirdStatus,
  onRefreshNetbirdCommandPreview,
  onUseSuggestedNetbirdHost,
}: SettingsTcpTransportSectionsProps) {
  if (activeRemoteProvider !== "tcp") {
    return null;
  }

  const blockedReason = resolveSettingsServerOperabilityBlockedReason(operability);
  const notice = resolveSettingsServerOperabilityNotice(operability);
  const controlsDisabled = blockedReason !== null;
  const netbirdStatusDisabled = controlsDisabled || netbirdStatusBusy;
  const netbirdCommandDisabled = controlsDisabled || netbirdCommandBusy;
  const netbirdSuggestedHostDisabled = controlsDisabled || !activeTcpSuggestedHost;
  const tailscaleStatusDisabled = controlsDisabled || tailscaleStatusBusy;
  const tailscaleCommandDisabled = controlsDisabled || tailscaleCommandBusy;
  const tailscaleSuggestedHostDisabled = controlsDisabled || !activeTcpSuggestedHost;

  return (
    <>
      <SettingsFieldGroup title="TCP overlay" subtitle={tcpOverlaySubtitle}>
        <SettingsField label="TCP overlay">
          <Select
            {...compactSelectProps}
            ariaLabel="TCP overlay"
            options={tcpOverlayOptions}
            value={activeTcpOverlay}
            disabled={controlsDisabled}
            onValueChange={(value) => {
              void onChangeTcpOverlay(value as RemoteTcpOverlay);
            }}
          />
        </SettingsField>
        {notice ? (
          <div className={`settings-help${notice.tone === "error" ? " settings-help-error" : ""}`}>
            {notice.text}
          </div>
        ) : null}
      </SettingsFieldGroup>

      <SettingsFieldGroup title="Remote backend" subtitle={tcpRemoteBackendHelp}>
        <SettingsField label="Remote backend connection">
          <div className="settings-field-row">
            <Input
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={remoteHostDraft}
              placeholder="127.0.0.1:4732"
              disabled={controlsDisabled}
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
              disabled={controlsDisabled}
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
        <SettingsMobileConnectFieldGroup
          mobileConnectBusy={mobileConnectBusy}
          mobileConnectStatusText={mobileConnectStatusText}
          mobileConnectStatusError={mobileConnectStatusError}
          disabled={controlsDisabled}
          onMobileConnectTest={onMobileConnectTest}
          subtitle="Make sure your desktop app daemon is running and reachable on the selected TCP overlay, then retry this test."
        />
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
                    disabled={controlsDisabled || tcpDaemonBusyAction !== null}
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
                    disabled={controlsDisabled || tcpDaemonBusyAction !== null}
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
                    disabled={controlsDisabled || tcpDaemonBusyAction !== null}
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
                        disabled={netbirdStatusDisabled}
                      >
                        {netbirdStatusBusy ? "Checking..." : "Detect NetBird"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onRefreshNetbirdCommandPreview}
                        disabled={netbirdCommandDisabled}
                      >
                        {netbirdCommandBusy ? "Refreshing..." : "Refresh setup command"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        disabled={netbirdSuggestedHostDisabled}
                        onClick={() => {
                          void onUseSuggestedNetbirdHost();
                        }}
                      >
                        Use suggested host
                      </Button>
                    </div>
                    {netbirdStatusError ? (
                      <div className="settings-help settings-help-error">{netbirdStatusError}</div>
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
                            Suggested remote host: <code>{netbirdStatus.suggestedRemoteHost}</code>
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
                      <div className="settings-help settings-help-error">{netbirdCommandError}</div>
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
                            Remote backend token is empty. Set one before exposing daemon access.
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
                        disabled={tailscaleStatusDisabled}
                      >
                        {tailscaleStatusBusy ? "Checking..." : "Detect Tailscale"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        onClick={onRefreshTailscaleCommandPreview}
                        disabled={tailscaleCommandDisabled}
                      >
                        {tailscaleCommandBusy ? "Refreshing..." : "Refresh daemon command"}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="settings-button-compact"
                        disabled={tailscaleSuggestedHostDisabled}
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
                            Remote backend token is empty. Set one before exposing daemon access.
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
  );
}
