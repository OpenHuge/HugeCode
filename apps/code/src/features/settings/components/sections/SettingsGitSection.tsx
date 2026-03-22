import { Button, Textarea } from "../../../../design-system";
import type { AppSettings } from "../../../../types";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import { SettingsToggleControl } from "../SettingsToggleControl";

type SettingsGitSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  commitMessagePromptDraft: string;
  commitMessagePromptDirty: boolean;
  commitMessagePromptSaving: boolean;
  onSetCommitMessagePromptDraft: (value: string) => void;
  onSaveCommitMessagePrompt: () => Promise<void>;
  onResetCommitMessagePrompt: () => Promise<void>;
};

export function SettingsGitSection({
  appSettings,
  onUpdateAppSettings,
  commitMessagePromptDraft,
  commitMessagePromptDirty,
  commitMessagePromptSaving,
  onSetCommitMessagePromptDraft,
  onSaveCommitMessagePrompt,
  onResetCommitMessagePrompt,
}: SettingsGitSectionProps) {
  return (
    <SettingsSectionFrame
      title="Git"
      subtitle="Manage how diffs are loaded in the workspace context rail."
    >
      <SettingsFieldGroup
        title="Diff behavior"
        subtitle="Tune what the context rail preloads and how diffs are filtered."
      >
        <SettingsControlRow
          title="Preload git diffs"
          subtitle="Make viewing git diff faster."
          control={
            <SettingsToggleControl
              checked={appSettings.preloadGitDiffs}
              ariaLabel="Preload git diffs"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  preloadGitDiffs: !appSettings.preloadGitDiffs,
                })
              }
            />
          }
        />
        <SettingsControlRow
          title="Ignore whitespace changes"
          subtitle="Hides whitespace-only changes in local and commit diffs."
          control={
            <SettingsToggleControl
              checked={appSettings.gitDiffIgnoreWhitespaceChanges}
              ariaLabel="Ignore whitespace changes"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  gitDiffIgnoreWhitespaceChanges: !appSettings.gitDiffIgnoreWhitespaceChanges,
                })
              }
            />
          }
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup
        title="Commit messages"
        subtitle="Edit the prompt used when generating commit message suggestions."
      >
        <SettingsField
          label="Commit message prompt"
          help={
            <>
              Used when generating commit messages. Include <code>{"{diff}"}</code> to insert the
              git diff.
            </>
          }
        >
          <Textarea
            fieldClassName={controlStyles.textareaField}
            className={controlStyles.textareaCode}
            value={commitMessagePromptDraft}
            onChange={(event) => onSetCommitMessagePromptDraft(event.target.value)}
            spellCheck={false}
            disabled={commitMessagePromptSaving}
            textareaSize="lg"
          />
          <SettingsFooterBar>
            <Button
              variant="ghost"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                void onResetCommitMessagePrompt();
              }}
              disabled={commitMessagePromptSaving || !commitMessagePromptDirty}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="settings-button-compact"
              onClick={() => {
                void onSaveCommitMessagePrompt();
              }}
              disabled={commitMessagePromptSaving || !commitMessagePromptDirty}
            >
              {commitMessagePromptSaving ? "Saving..." : "Save"}
            </Button>
          </SettingsFooterBar>
        </SettingsField>
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
