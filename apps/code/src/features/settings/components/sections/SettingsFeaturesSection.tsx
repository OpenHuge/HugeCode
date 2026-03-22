import { Button, Select, Switch, type SelectOption } from "../../../../design-system";
import type { AppSettings } from "../../../../types";
import { fileManagerName, openInFileManagerLabel } from "../../../../utils/platformPaths";
import {
  SettingsControlRow,
  SettingsFieldGroup,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import * as grammar from "../SettingsSectionGrammar.css";

type SettingsFeaturesSectionProps = {
  appSettings: AppSettings;
  hasCodexHomeOverrides: boolean;
  openConfigError: string | null;
  onOpenConfig: () => void;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function SettingsFeaturesSection({
  appSettings,
  hasCodexHomeOverrides,
  openConfigError,
  onOpenConfig,
  onUpdateAppSettings,
}: SettingsFeaturesSectionProps) {
  const personalityOptions: SelectOption[] = [
    { value: "friendly", label: "Friendly" },
    { value: "pragmatic", label: "Pragmatic" },
  ];

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    void onUpdateAppSettings({
      ...appSettings,
      [key]: value,
    });

  return (
    <SettingsSectionFrame
      title="Features"
      subtitle="Manage stable and experimental Codex features."
    >
      {hasCodexHomeOverrides && (
        <div className={grammar.helpText}>
          Feature settings are stored in the default CODEX_HOME config.toml.
          <br />
          Workspace overrides are not updated.
        </div>
      )}
      <SettingsFieldGroup
        title="Config access"
        subtitle={`Open the Codex config directly in ${fileManagerName()}.`}
      >
        <SettingsControlRow
          rowType="control"
          title="Config file"
          subtitle={`Open the Codex config in ${fileManagerName()}.`}
          control={
            <Button variant="ghost" size="sm" onClick={onOpenConfig}>
              {openInFileManagerLabel()}
            </Button>
          }
        />
        {openConfigError ? <div className={grammar.helpText}>{openConfigError}</div> : null}
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Stable Features"
        subtitle="Production-ready features enabled by default."
      >
        <SettingsControlRow
          title="Collaboration modes"
          subtitle="Enable collaboration mode presets (Code, Plan)."
          control={
            <Switch
              aria-label="Enable collaboration modes"
              checked={appSettings.collaborationModesEnabled}
              onCheckedChange={(checked) => updateSetting("collaborationModesEnabled", checked)}
            />
          }
        />
        <SettingsControlRow
          rowType="control"
          title="Personality"
          subtitle={
            <>
              Choose Codex communication style (writes top-level <code>personality</code> in
              config.toml).
            </>
          }
          control={
            <Select
              className={controlStyles.selectRoot}
              triggerClassName={controlStyles.selectTrigger}
              menuClassName={controlStyles.selectMenu}
              optionClassName={controlStyles.selectOption}
              ariaLabel="Personality"
              options={personalityOptions}
              value={appSettings.personality}
              onValueChange={(personality) =>
                void onUpdateAppSettings({
                  ...appSettings,
                  personality: personality as AppSettings["personality"],
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Steer mode"
          subtitle="Send messages immediately. Use Tab to queue while a run is active."
          control={
            <Switch
              aria-label="Enable steer mode"
              checked={appSettings.steerEnabled}
              onCheckedChange={(checked) => updateSetting("steerEnabled", checked)}
            />
          }
        />
        <SettingsControlRow
          title="Background terminal"
          subtitle="Run long-running terminal commands in the background."
          control={
            <Switch
              aria-label="Enable background terminal"
              checked={appSettings.unifiedExecEnabled}
              onCheckedChange={(checked) => updateSetting("unifiedExecEnabled", checked)}
            />
          }
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Experimental Features"
        subtitle="Preview features that may change or be removed."
      >
        <div className={grammar.helpText}>
          Extension work is skills-first. ChatGPT apps/connectors are no longer part of the active
          product surface.
        </div>
        <SettingsControlRow
          title="Internal runtime diagnostics"
          subtitle="Show planner and runtime diagnostic steps in the timeline for debugging."
          control={
            <Switch
              aria-label="Show internal runtime diagnostics"
              checked={appSettings.showInternalRuntimeDiagnostics}
              onCheckedChange={(checked) =>
                updateSetting("showInternalRuntimeDiagnostics", checked)
              }
            />
          }
        />
        <SettingsControlRow
          title="Multi-agent"
          subtitle="Enable multi-agent collaboration tools in Codex."
          control={
            <Switch
              aria-label="Enable multi-agent"
              checked={appSettings.experimentalCollabEnabled}
              onCheckedChange={(checked) => updateSetting("experimentalCollabEnabled", checked)}
            />
          }
        />
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
