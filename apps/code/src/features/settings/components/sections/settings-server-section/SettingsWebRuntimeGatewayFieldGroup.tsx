import type { Dispatch, SetStateAction } from "react";
import { Input, Select, type SelectOption } from "../../../../../design-system";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
} from "../../SettingsSectionGrammar";
import { SettingsToggleControl } from "../../SettingsToggleControl";
import {
  resolveSettingsServerOperabilityBlockedReason,
  resolveSettingsServerOperabilityNotice,
  type SettingsServerCompactSelectProps,
  type SettingsServerOperabilityState,
} from "./shared";

type SettingsWebRuntimeGatewayFieldGroupProps = {
  isMobileSimplified: boolean;
  gatewayEnabled: boolean;
  gatewayHttpBaseUrlDraft: string;
  gatewayWsBaseUrlDraft: string;
  gatewayTokenRefDraft: string;
  gatewayHealthcheckPathDraft: string;
  activeGatewayAuthMode: "none" | "token";
  compactInputFieldClassName: string;
  compactSelectProps: SettingsServerCompactSelectProps;
  gatewayAuthModeOptions: SelectOption[];
  operability: SettingsServerOperabilityState;
  onSetGatewayHttpBaseUrlDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayWsBaseUrlDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayTokenRefDraft: Dispatch<SetStateAction<string>>;
  onSetGatewayHealthcheckPathDraft: Dispatch<SetStateAction<string>>;
  onCommitGatewayHttpBaseUrl: () => Promise<void>;
  onCommitGatewayWsBaseUrl: () => Promise<void>;
  onCommitGatewayTokenRef: () => Promise<void>;
  onCommitGatewayHealthcheckPath: () => Promise<void>;
  onSetGatewayAuthMode: (authMode: "none" | "token") => Promise<void>;
  onToggleGatewayEnabled: () => Promise<void>;
};

export function SettingsWebRuntimeGatewayFieldGroup({
  isMobileSimplified,
  gatewayEnabled,
  gatewayHttpBaseUrlDraft,
  gatewayWsBaseUrlDraft,
  gatewayTokenRefDraft,
  gatewayHealthcheckPathDraft,
  activeGatewayAuthMode,
  compactInputFieldClassName,
  compactSelectProps,
  gatewayAuthModeOptions,
  operability,
  onSetGatewayHttpBaseUrlDraft,
  onSetGatewayWsBaseUrlDraft,
  onSetGatewayTokenRefDraft,
  onSetGatewayHealthcheckPathDraft,
  onCommitGatewayHttpBaseUrl,
  onCommitGatewayWsBaseUrl,
  onCommitGatewayTokenRef,
  onCommitGatewayHealthcheckPath,
  onSetGatewayAuthMode,
  onToggleGatewayEnabled,
}: SettingsWebRuntimeGatewayFieldGroupProps) {
  if (isMobileSimplified) {
    return null;
  }

  const blockedReason = resolveSettingsServerOperabilityBlockedReason(operability);
  const notice = resolveSettingsServerOperabilityNotice(operability);

  return (
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
                disabled={blockedReason !== null}
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
              disabled={blockedReason !== null}
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
              disabled={blockedReason !== null}
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
              disabled={blockedReason !== null}
              onValueChange={(value) => {
                void onSetGatewayAuthMode(value as "none" | "token");
              }}
            />
            <Input
              fieldClassName={compactInputFieldClassName}
              inputSize="sm"
              value={gatewayTokenRefDraft}
              placeholder="Gateway token ref"
              disabled={blockedReason !== null}
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
              disabled={blockedReason !== null}
              onValueChange={onSetGatewayHealthcheckPathDraft}
              onBlur={() => {
                void onCommitGatewayHealthcheckPath();
              }}
            />
          </div>
        </div>
      </SettingsField>
      {notice ? (
        <div className={`settings-help${notice.tone === "error" ? " settings-help-error" : ""}`}>
          {notice.text}
        </div>
      ) : null}
    </SettingsFieldGroup>
  );
}
