import { type MouseEventHandler, type ReactNode } from "react";
import { Dialog } from "./modal/ModalPrimitives";

type ModalShellProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  onBackdropClick?: MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};

export function ModalShell({
  open = true,
  onOpenChange,
  children,
  className,
  cardClassName,
  onBackdropClick,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange ?? (() => undefined)}
      className={className}
      cardClassName={cardClassName}
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
      ariaDescribedBy={ariaDescribedBy}
      onBackdropClick={onBackdropClick}
    >
      {children}
    </Dialog>
  );
}
