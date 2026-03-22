import { joinClassNames } from "../../../utils/classNames";
import type { LaunchScriptIconId } from "../utils/launchScriptIcons";
import { getLaunchScriptIcon, LAUNCH_SCRIPT_ICON_OPTIONS } from "../utils/launchScriptIcons";
import * as styles from "./LaunchScriptEditor.styles.css";

type LaunchScriptIconPickerProps = {
  value: LaunchScriptIconId;
  onChange: (value: LaunchScriptIconId) => void;
};

export function LaunchScriptIconPicker({ value, onChange }: LaunchScriptIconPickerProps) {
  return (
    <div className={styles.iconPicker}>
      {LAUNCH_SCRIPT_ICON_OPTIONS.map((option) => {
        const Icon = getLaunchScriptIcon(option.id);
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            className={joinClassNames(styles.iconOption, selected && styles.iconOptionSelected)}
            onClick={() => onChange(option.id)}
            aria-label={option.label}
            aria-pressed={selected}
            data-tauri-drag-region="false"
          >
            <Icon size={14} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
