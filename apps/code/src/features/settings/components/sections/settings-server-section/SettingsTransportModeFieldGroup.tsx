import { Select, type SelectOption } from "../../../../../design-system";
import type { AppSettings, RemoteBackendProvider } from "../../../../../types";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
} from "../../SettingsSectionGrammar";
import { SettingsToggleControl } from "../../SettingsToggleControl";
import type { SettingsServerCompactSelectProps } from "./shared";

type SettingsTransportModeFieldGroupProps = {
  appSettings: AppSettings;
  isMobileSimplified: boolean;
  transportGroupSubtitle: string;
  remoteProviderHelp: string;
  activeRemoteProvider: RemoteBackendProvider;
  compactSelectProps: SettingsServerCompactSelectProps;
  backendModeOptions: SelectOption[];
  remoteProviderOptions: SelectOption[];
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onChangeRemoteProvider: (provider: RemoteBackendProvider) => Promise<void>;
};

export function SettingsTransportModeFieldGroup({
  appSettings,
  isMobileSimplified,
  transportGroupSubtitle,
  remoteProviderHelp,
  activeRemoteProvider,
  compactSelectProps,
  backendModeOptions,
  remoteProviderOptions,
  onUpdateAppSettings,
  onChangeRemoteProvider,
}: SettingsTransportModeFieldGroupProps) {
  return (
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
  );
}
