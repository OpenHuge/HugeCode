import { Select, type SelectOption } from "../../../design-system";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AccessMode } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./ComposerAccessDropdown.styles.css";

const ACCESS_MENU_GAP = 2;
const ACCESS_MODE_OPTIONS: SelectOption[] = [
  { value: "read-only", label: "Read only" },
  { value: "on-request", label: "On-request" },
  { value: "full-access", label: "Full access" },
];

type ComposerAccessDropdownProps = {
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  disabled?: boolean;
  layout?: "grouped" | "standalone";
};

export function ComposerAccessDropdown({
  accessMode,
  onSelectAccessMode,
  disabled = false,
  layout = "grouped",
}: ComposerAccessDropdownProps) {
  const handleShellPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-ui-select-trigger="true"]')) {
      return;
    }
    const trigger = event.currentTarget.querySelector<HTMLButtonElement>(
      '[data-ui-select-trigger="true"]'
    );
    if (!trigger || trigger.disabled) {
      return;
    }
    event.preventDefault();
    trigger.focus();
    trigger.click();
  };

  return (
    <div
      className={joinClassNames(
        styles.shell,
        styles.shellLayout[layout],
        disabled ? styles.shellDisabled : null
      )}
      data-ds-select-anchor
      onPointerDown={handleShellPointerDown}
    >
      <span className={joinClassNames(styles.iconWrap, styles.iconTone[accessMode])} aria-hidden>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path
            d="M12 4l7 3v5c0 4.5-3 7.5-7 8-4-.5-7-3.5-7-8V7l7-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="15.5" r="1" fill="currentColor" />
        </svg>
      </span>
      <Select
        className={styles.selectRoot}
        triggerClassName={joinClassNames(
          styles.trigger,
          styles.triggerTone[accessMode],
          "composer-select-trigger"
        )}
        menuClassName={joinClassNames(styles.menu, "composer-select-menu")}
        optionClassName={joinClassNames(styles.option, "composer-select-option")}
        triggerDensity="compact"
        menuWidthMode="content"
        minMenuWidth={156}
        maxMenuWidth={220}
        menuGap={ACCESS_MENU_GAP}
        ariaLabel="Agent access"
        options={ACCESS_MODE_OPTIONS}
        value={accessMode}
        onValueChange={(value) => {
          if (!value) {
            return;
          }
          onSelectAccessMode(value as AccessMode);
        }}
        disabled={disabled}
      />
    </div>
  );
}
