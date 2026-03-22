import { Dialog } from "@ku0/design-system";
import type { MouseEventHandler, ReactNode } from "react";
import { createPortal } from "react-dom";

type SettingsShellModalProps = {
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  onBackdropClick?: MouseEventHandler<HTMLButtonElement>;
  ariaLabelledBy?: string;
};

export function SettingsShellModal({
  ariaLabelledBy,
  cardClassName,
  children,
  className,
  onBackdropClick,
}: SettingsShellModalProps) {
  const dialog = (
    <Dialog
      open
      onOpenChange={() => undefined}
      className={className}
      cardClassName={cardClassName}
      ariaLabelledBy={ariaLabelledBy}
      onBackdropClick={onBackdropClick}
    >
      {children}
    </Dialog>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
