import Play from "lucide-react/dist/esm/icons/play";
import type { LaunchScriptIconId } from "../../../types";
import { Button, Input, Textarea } from "../../../design-system";
import { DEFAULT_LAUNCH_SCRIPT_ICON } from "../utils/launchScriptIcons";
import { LaunchScriptIconPicker } from "./LaunchScriptIconPicker";
import * as styles from "./LaunchScriptEditor.styles.css";
import { LaunchScriptPopoverShell } from "./LaunchScriptPopoverShell";

type LaunchScriptButtonProps = {
  launchScript: string | null;
  editorOpen: boolean;
  draftScript: string;
  isSaving: boolean;
  error: string | null;
  onRun: () => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  showNew?: boolean;
  newEditorOpen?: boolean;
  newDraftScript?: string;
  newDraftIcon?: LaunchScriptIconId;
  newDraftLabel?: string;
  newError?: string | null;
  onOpenNew?: () => void;
  onCloseNew?: () => void;
  onNewDraftChange?: (value: string) => void;
  onNewDraftIconChange?: (value: LaunchScriptIconId) => void;
  onNewDraftLabelChange?: (value: string) => void;
  onCreateNew?: () => void;
};

export function LaunchScriptButton({
  launchScript,
  editorOpen,
  draftScript,
  isSaving,
  onRun,
  onOpenEditor,
  onCloseEditor,
  onDraftChange,
  onSave,
  showNew = false,
  newEditorOpen = false,
  newDraftScript = "",
  newDraftIcon = DEFAULT_LAUNCH_SCRIPT_ICON,
  newDraftLabel = "",
  onOpenNew,
  onCloseNew,
  onNewDraftChange,
  onNewDraftIconChange,
  onNewDraftLabelChange,
  onCreateNew,
}: LaunchScriptButtonProps) {
  const hasLaunchScript = Boolean(launchScript?.trim());
  const primaryButtonLabel = hasLaunchScript ? "Launch" : undefined;
  const buttonCopy = hasLaunchScript
    ? "Run launch script"
    : showNew
      ? "Add action"
      : "Set launch script";
  const handlePrimaryAction = !hasLaunchScript && showNew && onOpenNew ? onOpenNew : onRun;

  return (
    <LaunchScriptPopoverShell
      editorOpen={editorOpen}
      buttonAriaLabel={buttonCopy}
      buttonTitle={buttonCopy}
      buttonIcon={<Play size={16} aria-hidden />}
      buttonLabel={primaryButtonLabel}
      onRun={handlePrimaryAction}
      onOpenEditor={onOpenEditor}
      onCloseEditor={() => {
        onCloseEditor();
        onCloseNew?.();
      }}
    >
      <div className={styles.title}>Launch script</div>
      <Textarea
        className={styles.textarea}
        placeholder="e.g. npm run dev"
        value={draftScript}
        onChange={(event) => onDraftChange(event.target.value)}
        rows={6}
        data-tauri-drag-region="false"
      />
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onCloseEditor();
            onCloseNew?.();
          }}
          data-tauri-drag-region="false"
        >
          Cancel
        </Button>
        {showNew && onOpenNew && (
          <Button variant="ghost" size="sm" onClick={onOpenNew} data-tauri-drag-region="false">
            New
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          data-tauri-drag-region="false"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
      {showNew && newEditorOpen && onNewDraftChange && onNewDraftIconChange && onCreateNew && (
        <div className={styles.newSection}>
          <div className={styles.title}>New launch script</div>
          <LaunchScriptIconPicker value={newDraftIcon} onChange={onNewDraftIconChange} />
          <Input
            fieldClassName={styles.inputField}
            className={styles.inputControl}
            placeholder="Optional label"
            value={newDraftLabel}
            onChange={(event) => onNewDraftLabelChange?.(event.target.value)}
            data-tauri-drag-region="false"
          />
          <Textarea
            className={styles.textarea}
            placeholder="e.g. npm run dev"
            value={newDraftScript}
            onChange={(event) => onNewDraftChange(event.target.value)}
            rows={5}
            data-tauri-drag-region="false"
          />
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={onCloseNew} data-tauri-drag-region="false">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onCreateNew}
              disabled={isSaving}
              data-tauri-drag-region="false"
            >
              {isSaving ? "Saving..." : "Create"}
            </Button>
          </div>
        </div>
      )}
    </LaunchScriptPopoverShell>
  );
}
