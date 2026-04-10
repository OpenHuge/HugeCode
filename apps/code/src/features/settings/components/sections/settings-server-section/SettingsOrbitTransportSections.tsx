import type { Dispatch, SetStateAction } from "react";
import {
  resolveSettingsServerOperabilityBlockedReason,
  resolveSettingsServerOperabilityNotice,
  type SettingsServerOperabilityState,
} from "@ku0/code-workspace-client/settings-shell";
import { Button, Input } from "../../../../../design-system";
import type { AppSettings, RemoteBackendProvider } from "../../../../../types";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
} from "../../SettingsSectionGrammar";
import { SettingsToggleControl } from "../../SettingsToggleControl";
import { SettingsMobileConnectFieldGroup } from "./SettingsMobileConnectFieldGroup";

type SettingsOrbitTransportSectionsProps = {
  appSettings: AppSettings;
  activeRemoteProvider: RemoteBackendProvider;
  isMobileSimplified: boolean;
  activeOrbitUseAccess: boolean;
  compactInputFieldClassName: string;
  operability: SettingsServerOperabilityState;
  orbitWsUrlDraft: string;
  orbitAuthUrlDraft: string;
  orbitRunnerNameDraft: string;
  orbitAccessClientIdDraft: string;
  orbitAccessClientSecretRefDraft: string;
  remoteTokenDraft: string;
  orbitStatusText: string | null;
  orbitAuthCode: string | null;
  orbitVerificationUrl: string | null;
  orbitBusyAction: string | null;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onSetOrbitWsUrlDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAuthUrlDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitRunnerNameDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAccessClientIdDraft: Dispatch<SetStateAction<string>>;
  onSetOrbitAccessClientSecretRefDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onCommitOrbitWsUrl: () => Promise<void>;
  onCommitOrbitAuthUrl: () => Promise<void>;
  onCommitOrbitRunnerName: () => Promise<void>;
  onCommitOrbitAccessClientId: () => Promise<void>;
  onCommitOrbitAccessClientSecretRef: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onToggleOrbitUseAccess: () => Promise<void>;
  onOrbitConnectTest: () => void;
  onOrbitSignIn: () => void;
  onOrbitSignOut: () => void;
  onOrbitRunnerStart: () => void;
  onOrbitRunnerStop: () => void;
  onOrbitRunnerStatus: () => void;
  onMobileConnectTest: () => void;
};

export function SettingsOrbitTransportSections({
  appSettings,
  activeRemoteProvider,
  isMobileSimplified,
  activeOrbitUseAccess,
  compactInputFieldClassName,
  operability,
  orbitWsUrlDraft,
  orbitAuthUrlDraft,
  orbitRunnerNameDraft,
  orbitAccessClientIdDraft,
  orbitAccessClientSecretRefDraft,
  remoteTokenDraft,
  orbitStatusText,
  orbitAuthCode,
  orbitVerificationUrl,
  orbitBusyAction,
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
  onUpdateAppSettings,
  onSetOrbitWsUrlDraft,
  onSetOrbitAuthUrlDraft,
  onSetOrbitRunnerNameDraft,
  onSetOrbitAccessClientIdDraft,
  onSetOrbitAccessClientSecretRefDraft,
  onSetRemoteTokenDraft,
  onCommitOrbitWsUrl,
  onCommitOrbitAuthUrl,
  onCommitOrbitRunnerName,
  onCommitOrbitAccessClientId,
  onCommitOrbitAccessClientSecretRef,
  onCommitRemoteToken,
  onToggleOrbitUseAccess,
  onOrbitConnectTest,
  onOrbitSignIn,
  onOrbitSignOut,
  onOrbitRunnerStart,
  onOrbitRunnerStop,
  onOrbitRunnerStatus,
  onMobileConnectTest,
}: SettingsOrbitTransportSectionsProps) {
  if (activeRemoteProvider !== "orbit") {
    return null;
  }

  const blockedReason = resolveSettingsServerOperabilityBlockedReason(operability);
  const notice = resolveSettingsServerOperabilityNotice(operability);
  const controlsDisabled = blockedReason !== null;
  const orbitAccessFieldsDisabled = controlsDisabled || !activeOrbitUseAccess;
  const orbitActionsDisabled = controlsDisabled || orbitBusyAction !== null;

  return (
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
            disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
      {notice ? (
        <div className={`settings-help${notice.tone === "error" ? " settings-help-error" : ""}`}>
          {notice.text}
        </div>
      ) : null}

      {isMobileSimplified ? (
        <SettingsMobileConnectFieldGroup
          mobileConnectBusy={mobileConnectBusy}
          mobileConnectStatusText={mobileConnectStatusText}
          mobileConnectStatusError={mobileConnectStatusError}
          disabled={controlsDisabled}
          onMobileConnectTest={onMobileConnectTest}
          subtitle="Make sure the Orbit endpoint and token match your desktop setup, then retry."
        />
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
                  disabled={controlsDisabled}
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
                  disabled={controlsDisabled}
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
                disabled={orbitAccessFieldsDisabled}
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
                disabled={orbitAccessFieldsDisabled}
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
                    disabled={orbitActionsDisabled}
                  >
                    {orbitBusyAction === "connect-test" ? "Testing..." : "Connect test"}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={onOrbitSignIn}
                    disabled={orbitActionsDisabled}
                  >
                    {orbitBusyAction === "sign-in" ? "Signing In..." : "Sign In"}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={onOrbitSignOut}
                    disabled={orbitActionsDisabled}
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
                    disabled={orbitActionsDisabled}
                  >
                    {orbitBusyAction === "runner-start" ? "Starting..." : "Start Runner"}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={onOrbitRunnerStop}
                    disabled={orbitActionsDisabled}
                  >
                    {orbitBusyAction === "runner-stop" ? "Stopping..." : "Stop Runner"}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="settings-button-compact"
                    onClick={onOrbitRunnerStatus}
                    disabled={orbitActionsDisabled}
                  >
                    {orbitBusyAction === "runner-status" ? "Refreshing..." : "Refresh Status"}
                  </Button>
                </div>
                {orbitStatusText ? <div className="settings-help">{orbitStatusText}</div> : null}
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
  );
}
