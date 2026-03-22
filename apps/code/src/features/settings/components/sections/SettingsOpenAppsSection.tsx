import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Button, Input, Select, StatusBadge, type SelectOption } from "../../../../design-system";
import type { OpenAppTarget } from "../../../../types";
import { fileManagerName, isMacPlatform } from "../../../../utils/platformPaths";
import { resolveOpenAppGlyph } from "../../../app/utils/openAppGlyphs";
import {
  SettingsFieldGroup,
  SettingsFooterBar,
  SettingsSectionFrame,
} from "../SettingsSectionGrammar";
import * as grammar from "../SettingsSectionGrammar.css";
import type { OpenAppDraft } from "../settingsTypes";
import * as styles from "./SettingsOpenAppsSection.css";

type SettingsOpenAppsSectionProps = {
  openAppDrafts: OpenAppDraft[];
  openAppSelectedId: string;
  openAppIconById: Record<string, string>;
  onOpenAppDraftChange: (index: number, updates: Partial<OpenAppDraft>) => void;
  onOpenAppKindChange: (index: number, kind: OpenAppTarget["kind"]) => void;
  onCommitOpenApps: () => void;
  onMoveOpenApp: (index: number, direction: "up" | "down") => void;
  onDeleteOpenApp: (index: number) => void;
  onAddOpenApp: () => void;
  onSelectOpenAppDefault: (id: string) => void;
};

const isOpenAppLabelValid = (label: string) => label.trim().length > 0;
const openAppKindOptions: SelectOption[] = [
  { value: "app", label: "App" },
  { value: "command", label: "Command" },
  { value: "finder", label: fileManagerName() },
];

export function SettingsOpenAppsSection({
  openAppDrafts,
  openAppSelectedId,
  openAppIconById,
  onOpenAppDraftChange,
  onOpenAppKindChange,
  onCommitOpenApps,
  onMoveOpenApp,
  onDeleteOpenApp,
  onAddOpenApp,
  onSelectOpenAppDefault,
}: SettingsOpenAppsSectionProps) {
  return (
    <SettingsSectionFrame
      title="Open in"
      subtitle="Customize the Open in menu shown in the title bar and file previews."
    >
      <SettingsFieldGroup
        title="Menu entries"
        subtitle="Reorder actions, switch defaults, and control how each target launches."
      >
        <div className={styles.openApps}>
          {openAppDrafts.map((target, index) => {
            const labelValid = isOpenAppLabelValid(target.label);
            const appNameValid = target.kind !== "app" || Boolean(target.appName?.trim());
            const commandValid = target.kind !== "command" || Boolean(target.command?.trim());
            const isComplete = labelValid && appNameValid && commandValid;
            const incompleteHint = !labelValid
              ? "Label required"
              : target.kind === "app"
                ? "App name required"
                : target.kind === "command"
                  ? "Command required"
                  : "Complete required fields";

            return (
              <div
                key={target.id}
                className={`${styles.row} ${isComplete ? styles.rowState.complete : styles.rowState.incomplete}`}
              >
                <div className={styles.iconWrap} aria-hidden>
                  {resolveOpenAppGlyph(target, {
                    className: styles.icon,
                    iconById: openAppIconById,
                  })}
                </div>
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <Input
                      inputSize="sm"
                      fieldClassName={`${styles.controlSurface} ${styles.inputWidth.label}`}
                      value={target.label}
                      placeholder="Label"
                      onValueChange={(label) => onOpenAppDraftChange(index, { label })}
                      onBlur={onCommitOpenApps}
                      aria-label={`Open app label ${index + 1}`}
                      error={!labelValid}
                    />
                  </div>
                  <div className={styles.field}>
                    <Select
                      className={styles.kind}
                      triggerClassName={styles.selectTrigger}
                      menuClassName={styles.selectMenu}
                      optionClassName={styles.selectOption}
                      triggerDensity="compact"
                      menuWidthMode="trigger"
                      ariaLabel={`Open app type ${index + 1}`}
                      options={openAppKindOptions}
                      value={target.kind}
                      onValueChange={(kind) =>
                        onOpenAppKindChange(index, kind as OpenAppTarget["kind"])
                      }
                    />
                  </div>
                  {target.kind === "app" && (
                    <div className={styles.field}>
                      <Input
                        inputSize="sm"
                        fieldClassName={`${styles.controlSurface} ${styles.inputWidth.appName}`}
                        value={target.appName ?? ""}
                        placeholder="App name"
                        onValueChange={(appName) => onOpenAppDraftChange(index, { appName })}
                        onBlur={onCommitOpenApps}
                        aria-label={`Open app name ${index + 1}`}
                        error={!appNameValid}
                      />
                    </div>
                  )}
                  {target.kind === "command" && (
                    <div className={styles.field}>
                      <Input
                        inputSize="sm"
                        fieldClassName={`${styles.controlSurface} ${styles.inputWidth.command}`}
                        value={target.command ?? ""}
                        placeholder="Command"
                        onValueChange={(command) => onOpenAppDraftChange(index, { command })}
                        onBlur={onCommitOpenApps}
                        aria-label={`Open app command ${index + 1}`}
                        error={!commandValid}
                      />
                    </div>
                  )}
                  {target.kind !== "finder" && (
                    <div className={styles.field}>
                      <Input
                        inputSize="sm"
                        fieldClassName={`${styles.controlSurface} ${styles.inputWidth.args}`}
                        value={target.argsText}
                        placeholder="Args"
                        onValueChange={(argsText) => onOpenAppDraftChange(index, { argsText })}
                        onBlur={onCommitOpenApps}
                        aria-label={`Open app args ${index + 1}`}
                      />
                    </div>
                  )}
                </div>
                <div className={styles.actions}>
                  {!isComplete && (
                    <StatusBadge className={styles.status} tone="error" title={incompleteHint}>
                      Incomplete
                    </StatusBadge>
                  )}
                  <label className={styles.defaultOption}>
                    <input
                      type="radio"
                      name="open-app-default"
                      checked={target.id === openAppSelectedId}
                      onChange={() => onSelectOpenAppDefault(target.id)}
                      disabled={!isComplete}
                    />
                    Default
                  </label>
                  <div className={styles.order}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMoveOpenApp(index, "up")}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ChevronUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onMoveOpenApp(index, "down")}
                      disabled={index === openAppDrafts.length - 1}
                      aria-label="Move down"
                    >
                      <ChevronDown aria-hidden />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteOpenApp(index)}
                    disabled={openAppDrafts.length <= 1}
                    aria-label="Remove app"
                    title="Remove app"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <SettingsFooterBar className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={onAddOpenApp}>
            Add app
          </Button>
          <div className={grammar.helpText}>
            Commands receive the selected path as the final argument.{" "}
            {isMacPlatform()
              ? "Apps open via `open -a` with optional args."
              : "Apps run as an executable with optional args."}
          </div>
        </SettingsFooterBar>
      </SettingsFieldGroup>
    </SettingsSectionFrame>
  );
}
