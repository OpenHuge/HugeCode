import { useEffect, useRef } from "react";
import {
  DialogButton,
  DialogDescription,
  DialogFooter,
  DialogInput,
  DialogLabel,
  DialogTitle,
  compactModalCard,
  ModalShell,
} from "../../../design-system";

type RenameThreadPromptProps = {
  currentName: string;
  name: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RenameThreadPrompt({
  currentName,
  name,
  onChange,
  onCancel,
  onConfirm,
}: RenameThreadPromptProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <ModalShell
      cardClassName={compactModalCard}
      onBackdropClick={onCancel}
      ariaLabelledBy="rename-thread-title"
      ariaDescribedBy="rename-thread-subtitle"
    >
      <DialogTitle id="rename-thread-title">Rename thread</DialogTitle>
      <DialogDescription id="rename-thread-subtitle">
        Current name: "{currentName}"
      </DialogDescription>
      <DialogLabel htmlFor="thread-rename">New name</DialogLabel>
      <DialogInput
        id="thread-rename"
        ref={inputRef}
        value={name}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onConfirm();
          }
        }}
      />
      <DialogFooter>
        <DialogButton variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={name.trim().length === 0}
        >
          Rename
        </DialogButton>
      </DialogFooter>
    </ModalShell>
  );
}
