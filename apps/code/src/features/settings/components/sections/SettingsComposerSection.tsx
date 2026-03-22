import { Select, type SelectOption } from "../../../../design-system";
import type { AppSettings } from "../../../../types";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import { SettingsToggleControl } from "../SettingsToggleControl";

type ComposerPreset = AppSettings["composerEditorPreset"];

type SettingsComposerSectionProps = {
  appSettings: AppSettings;
  optionKeyLabel: string;
  composerPresetLabels: Record<ComposerPreset, string>;
  onComposerPresetChange: (preset: ComposerPreset) => void;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function SettingsComposerSection({
  appSettings,
  optionKeyLabel,
  composerPresetLabels,
  onComposerPresetChange,
  onUpdateAppSettings,
}: SettingsComposerSectionProps) {
  const presetOptions: SelectOption[] = Object.entries(composerPresetLabels).map(
    ([preset, label]) => ({
      value: preset,
      label,
    })
  );

  return (
    <SettingsSectionFrame
      title="Composer"
      subtitle="Control helpers and formatting behavior inside the message editor."
    >
      <SettingsFieldGroup
        title="Presets"
        subtitle="Choose a starting point and fine-tune the toggles below."
      >
        <SettingsField
          label="Preset"
          help="Presets update the toggles below. Customize any setting after selecting."
        >
          <Select
            className={controlStyles.selectRoot}
            triggerClassName={controlStyles.selectTrigger}
            menuClassName={controlStyles.selectMenu}
            optionClassName={controlStyles.selectOption}
            ariaLabel="Preset"
            options={presetOptions}
            value={appSettings.composerEditorPreset}
            onValueChange={(preset) => onComposerPresetChange(preset as ComposerPreset)}
          />
        </SettingsField>
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Code fences"
        subtitle="Control how fenced code blocks are expanded, tagged, wrapped, and copied."
      >
        <SettingsControlRow
          title="Expand fences on Space"
          subtitle="Typing ``` then Space inserts a fenced block."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceExpandOnSpace}
              ariaLabel="Toggle expand fences on Space"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceExpandOnSpace: !appSettings.composerFenceExpandOnSpace,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Expand fences on Enter"
          subtitle="Use Enter to expand ``` lines when enabled."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceExpandOnEnter}
              ariaLabel="Toggle expand fences on Enter"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceExpandOnEnter: !appSettings.composerFenceExpandOnEnter,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Support language tags"
          subtitle="Allows ```lang + Space to include a language."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceLanguageTags}
              ariaLabel="Toggle language tags in code fences"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceLanguageTags: !appSettings.composerFenceLanguageTags,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Wrap selection in fences"
          subtitle="Wraps selected text when creating a fence."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceWrapSelection}
              ariaLabel="Toggle wrap selection in code fences"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceWrapSelection: !appSettings.composerFenceWrapSelection,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Copy blocks without fences"
          subtitle={`When enabled, Copy is plain text. Hold ${optionKeyLabel} to include \`\`\` fences.`}
          control={
            <SettingsToggleControl
              checked={appSettings.composerCodeBlockCopyUseModifier}
              ariaLabel="Toggle copy blocks without fences"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerCodeBlockCopyUseModifier: !appSettings.composerCodeBlockCopyUseModifier,
                })
              }
            />
          }
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Pasting"
        subtitle="Choose how pasted code and multi-line content are normalized."
      >
        <SettingsControlRow
          title="Auto-wrap multi-line paste"
          subtitle="Wraps multi-line paste inside a fenced block."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceAutoWrapPasteMultiline}
              ariaLabel="Toggle auto-wrap multi-line paste"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceAutoWrapPasteMultiline:
                    !appSettings.composerFenceAutoWrapPasteMultiline,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Auto-wrap code-like single lines"
          subtitle="Wraps long single-line code snippets on paste."
          control={
            <SettingsToggleControl
              checked={appSettings.composerFenceAutoWrapPasteCodeLike}
              ariaLabel="Toggle auto-wrap code-like single lines"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerFenceAutoWrapPasteCodeLike:
                    !appSettings.composerFenceAutoWrapPasteCodeLike,
                })
              }
            />
          }
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Lists"
        subtitle="Control list continuation behavior while composing messages."
      >
        <SettingsControlRow
          title="Continue lists on Shift+Enter"
          subtitle="Continues numbered and bulleted lists when the line has content."
          control={
            <SettingsToggleControl
              checked={appSettings.composerListContinuation}
              ariaLabel="Toggle list continuation on Shift+Enter"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  composerListContinuation: !appSettings.composerListContinuation,
                })
              }
            />
          }
        />
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
