import type { LaunchScriptEntry, LaunchScriptIconId } from "../../../types";
import { Button, Input, Textarea } from "../../../design-system";
import { getLaunchScriptIcon, getLaunchScriptIconLabel } from "../utils/launchScriptIcons";
import * as styles from "./LaunchScriptEditor.styles.css";
import { LaunchScriptIconPicker } from "./LaunchScriptIconPicker";
import { LaunchScriptPopoverShell } from "./LaunchScriptPopoverShell";

type LaunchScriptEntryButtonProps = {
  entry: LaunchScriptEntry;
  editorOpen: boolean;
  draftScript: string;
  draftIcon: LaunchScriptIconId;
  draftLabel: string;
  isSaving: boolean;
  error: string | null;
  onRun: () => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onDraftChange: (value: string) => void;
  onDraftIconChange: (value: LaunchScriptIconId) => void;
  onDraftLabelChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function LaunchScriptEntryButton({
  entry,
  editorOpen,
  draftScript,
  draftIcon,
  draftLabel,
  isSaving,
  onRun,
  onOpenEditor,
  onCloseEditor,
  onDraftChange,
  onDraftIconChange,
  onDraftLabelChange,
  onSave,
  onDelete,
}: LaunchScriptEntryButtonProps) {
  const Icon = getLaunchScriptIcon(entry.icon);
  const iconLabel = getLaunchScriptIconLabel(entry.icon);

  return (
    <LaunchScriptPopoverShell
      editorOpen={editorOpen}
      buttonAriaLabel={entry.label?.trim() || iconLabel}
      buttonTitle={entry.label?.trim() || iconLabel}
      buttonIcon={<Icon size={14} aria-hidden />}
      onRun={onRun}
      onOpenEditor={onOpenEditor}
      onCloseEditor={onCloseEditor}
    >
      <div className={styles.title}>{entry.label?.trim() || "Launch script"}</div>
      <LaunchScriptIconPicker value={draftIcon} onChange={onDraftIconChange} />
      <Input
        fieldClassName={styles.inputField}
        className={styles.inputControl}
        placeholder="Optional label"
        value={draftLabel}
        onChange={(event) => onDraftLabelChange(event.target.value)}
        data-desktop-drag-region="false"
      />
      <Textarea
        className={styles.textarea}
        placeholder="e.g. npm run dev"
        value={draftScript}
        onChange={(event) => onDraftChange(event.target.value)}
        rows={6}
        data-desktop-drag-region="false"
      />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCloseEditor} data-desktop-drag-region="false">
          Cancel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={styles.deleteButton}
          onClick={onDelete}
          data-desktop-drag-region="false"
        >
          Delete
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          data-desktop-drag-region="false"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </LaunchScriptPopoverShell>
  );
}
