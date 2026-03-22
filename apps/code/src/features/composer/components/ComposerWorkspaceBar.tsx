import type { AccessMode, ThreadTokenUsage } from "../../../types";
import { ComposerAccessDropdown } from "./ComposerAccessDropdown";
import { ComposerBranchDropdown } from "./ComposerBranchDropdown";
import { ComposerContextIndicator } from "./ComposerContextUsage";
import { ComposerWorkspaceFooter } from "./ComposerShell";
import type { ComposerWorkspaceControls } from "./ComposerWorkspaceControls";
import * as styles from "./ComposerWorkspaceBar.css";

type ComposerWorkspaceBarProps = {
  controls: ComposerWorkspaceControls | null;
  contextUsage?: ThreadTokenUsage | null;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  disabled?: boolean;
};

function resolveWorkspaceBadge(mode: ComposerWorkspaceControls["mode"]) {
  return mode === "worktree" ? "Worktree" : "Local";
}

export function ComposerWorkspaceBar({
  controls,
  contextUsage,
  accessMode,
  onSelectAccessMode,
  disabled = false,
}: ComposerWorkspaceBarProps) {
  const workspaceBadgeLabel = controls ? resolveWorkspaceBadge(controls.mode) : "Local";

  return (
    <ComposerWorkspaceFooter
      className={styles.root}
      leading={
        <div className={styles.leading}>
          <div className={styles.workspaceRail}>
            <div className={styles.supportRail}>
              <span className={styles.badge}>
                <svg className={styles.badgeIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect
                    x="3.75"
                    y="5.25"
                    width="16.5"
                    height="11.5"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 19h8M10 16.75h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {workspaceBadgeLabel}
              </span>
              <div className={styles.accessSlot}>
                <ComposerAccessDropdown
                  accessMode={accessMode}
                  onSelectAccessMode={onSelectAccessMode}
                  disabled={disabled}
                  layout="grouped"
                />
              </div>
            </div>
          </div>
        </div>
      }
      trailing={
        controls || contextUsage ? (
          <div className={styles.trailing}>
            {controls ? <ComposerBranchDropdown controls={controls} disabled={disabled} /> : null}
            <ComposerContextIndicator contextUsage={contextUsage} />
          </div>
        ) : null
      }
    />
  );
}
