import { useEffect, useRef } from "react";
import {
  Button,
  DialogButton,
  DialogDescription,
  DialogError,
  DialogFooter,
  DialogInput,
  DialogLabel,
  DialogTextarea,
  DialogTitle,
  ModalShell,
} from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./ClonePrompt.css";

type ClonePromptProps = {
  workspaceName: string;
  copyName: string;
  copiesFolder: string;
  suggestedCopiesFolder?: string | null;
  error?: string | null;
  onCopyNameChange: (value: string) => void;
  onChooseCopiesFolder: () => void;
  onUseSuggestedCopiesFolder: () => void;
  onClearCopiesFolder: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
};

export function ClonePrompt({
  workspaceName,
  copyName,
  copiesFolder,
  suggestedCopiesFolder = null,
  error = null,
  onCopyNameChange,
  onChooseCopiesFolder,
  onUseSuggestedCopiesFolder,
  onClearCopiesFolder,
  onCancel,
  onConfirm,
  isBusy = false,
}: ClonePromptProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const canCreate = copyName.trim().length > 0 && copiesFolder.trim().length > 0;
  const showSuggested = Boolean(suggestedCopiesFolder) && copiesFolder.trim().length === 0;

  return (
    <ModalShell
      open={true}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isBusy) {
          onCancel();
        }
      }}
      cardClassName={styles.modalCard}
      ariaLabel="New clone agent"
    >
      <DialogTitle>New clone agent</DialogTitle>
      <DialogDescription>Create a new working copy of "{workspaceName}".</DialogDescription>
      <DialogLabel htmlFor="clone-copy-name">Copy name</DialogLabel>
      <DialogInput
        id="clone-copy-name"
        ref={inputRef}
        value={copyName}
        onChange={(event) => onCopyNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!isBusy) {
              onCancel();
            }
          }
          if (event.key === "Enter" && canCreate && !isBusy) {
            event.preventDefault();
            onConfirm();
          }
        }}
      />
      <DialogLabel htmlFor="clone-copies-folder">Copies folder</DialogLabel>
      <div className={styles.row}>
        <DialogTextarea
          id="clone-copies-folder"
          fieldClassName={styles.field}
          className={styles.pathInput}
          value={copiesFolder}
          placeholder="Not set"
          readOnly
          rows={1}
          wrap="off"
          onFocus={(event) => {
            const value = event.currentTarget.value;
            event.currentTarget.setSelectionRange(value.length, value.length);
            requestAnimationFrame(() => {
              event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (!isBusy) {
                onCancel();
              }
            }
            if (event.key === "Enter" && canCreate && !isBusy) {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className={styles.button}
          onClick={onChooseCopiesFolder}
          disabled={isBusy}
        >
          Choose…
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={styles.button}
          onClick={onClearCopiesFolder}
          disabled={isBusy || copiesFolder.trim().length === 0}
        >
          Clear
        </Button>
      </div>
      {showSuggested && (
        <div className={styles.suggested}>
          <div className={styles.suggestedLabel}>Suggested</div>
          <div className={styles.row}>
            <DialogTextarea
              fieldClassName={styles.field}
              className={joinClassNames(styles.pathInput, styles.suggestedPath)}
              value={suggestedCopiesFolder ?? ""}
              readOnly
              rows={1}
              wrap="off"
              aria-label="Suggested copies folder"
              title={suggestedCopiesFolder ?? ""}
              onFocus={(event) => {
                const value = event.currentTarget.value;
                event.currentTarget.setSelectionRange(value.length, value.length);
                requestAnimationFrame(() => {
                  event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
                });
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className={styles.button}
              onClick={async () => {
                if (!suggestedCopiesFolder) {
                  return;
                }
                try {
                  await navigator.clipboard.writeText(suggestedCopiesFolder);
                } catch {
                  // Ignore clipboard failures (e.g. permission denied).
                }
              }}
              disabled={isBusy || !suggestedCopiesFolder}
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={styles.button}
              onClick={onUseSuggestedCopiesFolder}
              disabled={isBusy}
            >
              Use suggested
            </Button>
          </div>
        </div>
      )}
      {error && <DialogError>{error}</DialogError>}
      <DialogFooter>
        <DialogButton
          variant="ghost"
          size="sm"
          className={styles.button}
          onClick={onCancel}
          disabled={isBusy}
        >
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          size="sm"
          className={styles.button}
          onClick={onConfirm}
          disabled={isBusy || !canCreate}
        >
          Create
        </DialogButton>
      </DialogFooter>
    </ModalShell>
  );
}
