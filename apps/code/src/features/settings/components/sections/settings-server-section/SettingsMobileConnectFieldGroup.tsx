import { Button } from "../../../../../design-system";
import { SettingsField, SettingsFieldGroup } from "../../SettingsSectionGrammar";

type SettingsMobileConnectFieldGroupProps = {
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  disabled?: boolean;
  onMobileConnectTest: () => void;
  subtitle: string;
};

export function SettingsMobileConnectFieldGroup({
  mobileConnectBusy,
  mobileConnectStatusText,
  mobileConnectStatusError,
  disabled = false,
  onMobileConnectTest,
  subtitle,
}: SettingsMobileConnectFieldGroupProps) {
  return (
    <SettingsFieldGroup title="Connection test" subtitle={subtitle}>
      <SettingsField label="Connection test">
        <div className="settings-field">
          <div className="settings-field-row">
            <Button
              variant="primary"
              size="sm"
              className="settings-button-compact"
              onClick={onMobileConnectTest}
              disabled={disabled || mobileConnectBusy}
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
  );
}
