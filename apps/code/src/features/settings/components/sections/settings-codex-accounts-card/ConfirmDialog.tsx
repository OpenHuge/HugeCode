import { useCallback, useEffect, useRef } from "react";
import {
  DialogButton,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  compactModalCard,
  ModalShell,
} from "../../../../../design-system";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      // Focus the confirm button when the dialog opens
      requestAnimationFrame(() => {
        confirmRef.current?.focus();
      });
    }
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (!open) {
    return null;
  }

  return (
    <ModalShell
      className="settings-overlay"
      cardClassName={compactModalCard}
      onBackdropClick={handleBackdropClick}
      ariaLabel={title}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{message}</DialogDescription>
      <DialogFooter>
        <DialogButton variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </DialogButton>
        <DialogButton ref={confirmRef} variant={variant} size="sm" onClick={onConfirm}>
          {confirmLabel}
        </DialogButton>
      </DialogFooter>
    </ModalShell>
  );
}
