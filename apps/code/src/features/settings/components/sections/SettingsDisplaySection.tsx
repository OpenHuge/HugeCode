import type { Dispatch, SetStateAction } from "react";
import { Button, Input, Select, type SelectOption } from "../../../../design-system";
import type { AppSettings } from "../../../../types";
import {
  CODE_FONT_SIZE_DEFAULT,
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
} from "../../../../utils/fonts";
import {
  SettingsControlRow,
  SettingsField,
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as controlStyles from "../SettingsFormControls.css";
import * as grammar from "../SettingsSectionGrammar.css";
import { SettingsToggleControl } from "../SettingsToggleControl";

type SettingsDisplaySectionProps = {
  appSettings: AppSettings;
  reduceTransparency: boolean;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  scaleDraft: string;
  uiFontDraft: string;
  codeFontDraft: string;
  codeFontSizeDraft: number;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onToggleTransparency: (value: boolean) => void;
  onSetScaleDraft: Dispatch<SetStateAction<string>>;
  onCommitScale: () => Promise<void>;
  onResetScale: () => Promise<void>;
  onSetUiFontDraft: Dispatch<SetStateAction<string>>;
  onCommitUiFont: () => Promise<void>;
  onSetCodeFontDraft: Dispatch<SetStateAction<string>>;
  onCommitCodeFont: () => Promise<void>;
  onSetCodeFontSizeDraft: Dispatch<SetStateAction<number>>;
  onCommitCodeFontSize: (nextSize: number) => Promise<void>;
  onTestNotificationSound: () => void;
  onTestSystemNotification: () => void;
};

export function SettingsDisplaySection({
  appSettings,
  reduceTransparency,
  scaleShortcutTitle,
  scaleShortcutText,
  scaleDraft,
  uiFontDraft,
  codeFontDraft,
  codeFontSizeDraft,
  onUpdateAppSettings,
  onToggleTransparency,
  onSetScaleDraft,
  onCommitScale,
  onResetScale,
  onSetUiFontDraft,
  onCommitUiFont,
  onSetCodeFontDraft,
  onCommitCodeFont,
  onSetCodeFontSizeDraft,
  onCommitCodeFontSize,
  onTestNotificationSound,
  onTestSystemNotification,
}: SettingsDisplaySectionProps) {
  const compactInputFieldClassName = `${controlStyles.inputField} ${controlStyles.inputFieldCompact}`;
  const themeOptions: SelectOption[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "dim", label: "Dim" },
  ];

  return (
    <SettingsSectionFrame
      title="Display & Sound"
      subtitle="Tune visuals and audio alerts to your preferences."
    >
      <SettingsFieldGroup
        title="Display"
        subtitle="Adjust how the window renders backgrounds and effects."
      >
        <SettingsField label="Theme">
          <Select
            className={controlStyles.selectRoot}
            triggerClassName={controlStyles.selectTrigger}
            menuClassName={controlStyles.selectMenu}
            optionClassName={controlStyles.selectOption}
            ariaLabel="Theme"
            options={themeOptions}
            value={appSettings.theme}
            onValueChange={(theme) =>
              void onUpdateAppSettings({
                ...appSettings,
                theme: theme as AppSettings["theme"],
              })
            }
          />
        </SettingsField>

        <SettingsControlRow
          title="Show remaining Codex limits"
          subtitle="Display what is left instead of what is used."
          control={
            <SettingsToggleControl
              checked={appSettings.usageShowRemaining}
              ariaLabel="Show remaining Codex limits"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  usageShowRemaining: !appSettings.usageShowRemaining,
                })
              }
            />
          }
        />

        <SettingsControlRow
          title="Show file path in messages"
          subtitle="Display the parent path next to file links in messages."
          control={
            <SettingsToggleControl
              checked={appSettings.showMessageFilePath}
              ariaLabel="Show file path in messages"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  showMessageFilePath: !appSettings.showMessageFilePath,
                })
              }
            />
          }
        />

        <SettingsControlRow
          title="Split chat and diff center panes"
          subtitle="Show chat and diff side by side instead of swapping between them."
          control={
            <SettingsToggleControl
              checked={appSettings.splitChatDiffView}
              ariaLabel="Split chat and diff center panes"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  splitChatDiffView: !appSettings.splitChatDiffView,
                })
              }
            />
          }
        />

        <SettingsControlRow
          title="Auto-generate new thread titles"
          subtitle="Generate a short title from your first message (uses extra tokens)."
          control={
            <SettingsToggleControl
              checked={appSettings.threadTitleAutogenerationEnabled}
              ariaLabel="Auto-generate new thread titles"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  threadTitleAutogenerationEnabled: !appSettings.threadTitleAutogenerationEnabled,
                })
              }
            />
          }
        />

        <SettingsControlRow
          title="Reduce transparency"
          subtitle="Use solid surfaces instead of glass."
          control={
            <SettingsToggleControl
              checked={reduceTransparency}
              ariaLabel="Reduce transparency"
              onCheckedChange={(checked) => onToggleTransparency(checked)}
            />
          }
        />

        <SettingsControlRow
          rowType="control"
          title="Interface scale"
          subtitle={<span title={scaleShortcutTitle}>{scaleShortcutText}</span>}
          control={
            <div className={grammar.fieldControlRow}>
              <Input
                id="ui-scale"
                type="text"
                inputMode="decimal"
                className={controlStyles.inputControlAlignEnd}
                fieldClassName={`${compactInputFieldClassName} ${controlStyles.inputFieldNarrow}`}
                inputSize="sm"
                value={scaleDraft}
                aria-label="Interface scale"
                onValueChange={onSetScaleDraft}
                onBlur={() => {
                  void onCommitScale();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onCommitScale();
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="settings-button-compact"
                onClick={() => {
                  void onResetScale();
                }}
              >
                Reset
              </Button>
            </div>
          }
        />

        <SettingsField
          label="UI font family"
          htmlFor="ui-font-family"
          help="Applies to all UI text. Leave empty to use the default system font stack."
        >
          <Input
            id="ui-font-family"
            type="text"
            fieldClassName={controlStyles.inputField}
            inputSize="md"
            value={uiFontDraft}
            onValueChange={onSetUiFontDraft}
            onBlur={() => {
              void onCommitUiFont();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitUiFont();
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              onSetUiFontDraft(DEFAULT_UI_FONT_FAMILY);
              void onUpdateAppSettings({
                ...appSettings,
                uiFontFamily: DEFAULT_UI_FONT_FAMILY,
              });
            }}
          >
            Reset
          </Button>
        </SettingsField>

        <SettingsField
          label="Code font family"
          htmlFor="code-font-family"
          help="Applies to git diffs and other mono-spaced readouts."
        >
          <Input
            id="code-font-family"
            type="text"
            fieldClassName={controlStyles.inputField}
            inputSize="md"
            value={codeFontDraft}
            onValueChange={onSetCodeFontDraft}
            onBlur={() => {
              void onCommitCodeFont();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onCommitCodeFont();
              }
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              onSetCodeFontDraft(DEFAULT_CODE_FONT_FAMILY);
              void onUpdateAppSettings({
                ...appSettings,
                codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
              });
            }}
          >
            Reset
          </Button>
        </SettingsField>

        <SettingsField
          label="Code font size"
          htmlFor="code-font-size"
          help="Adjusts code and diff text size."
        >
          <input
            id="code-font-size"
            type="range"
            min={CODE_FONT_SIZE_MIN}
            max={CODE_FONT_SIZE_MAX}
            step={1}
            className={controlStyles.rangeInput}
            value={codeFontSizeDraft}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onSetCodeFontSizeDraft(nextValue);
              void onCommitCodeFontSize(nextValue);
            }}
          />
          <div className={grammar.valueText}>{codeFontSizeDraft}px</div>
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={() => {
              onSetCodeFontSizeDraft(CODE_FONT_SIZE_DEFAULT);
              void onCommitCodeFontSize(CODE_FONT_SIZE_DEFAULT);
            }}
          >
            Reset
          </Button>
        </SettingsField>
      </SettingsFieldGroup>

      <SettingsFieldGroup title="Sounds" subtitle="Control notification audio alerts.">
        <SettingsControlRow
          title="Notification sounds"
          subtitle="Play a sound when a long-running agent finishes while the window is unfocused."
          control={
            <SettingsToggleControl
              checked={appSettings.notificationSoundsEnabled}
              ariaLabel="Enable notification sounds"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  notificationSoundsEnabled: !appSettings.notificationSoundsEnabled,
                })
              }
            />
          }
        />

        <SettingsControlRow
          title="System notifications"
          subtitle="Show a system notification when a long-running agent finishes while the window is unfocused."
          control={
            <SettingsToggleControl
              checked={appSettings.systemNotificationsEnabled}
              ariaLabel="Enable system notifications"
              onCheckedChange={() =>
                void onUpdateAppSettings({
                  ...appSettings,
                  systemNotificationsEnabled: !appSettings.systemNotificationsEnabled,
                })
              }
            />
          }
        />

        <SettingsFooterBar>
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={onTestNotificationSound}
          >
            Test sound
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="settings-button-compact"
            onClick={onTestSystemNotification}
          >
            Test notification
          </Button>
        </SettingsFooterBar>
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
