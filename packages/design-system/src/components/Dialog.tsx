import {
  forwardRef,
  type HTMLAttributes,
  type LabelHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  useEffect,
} from "react";
import { Button, type ButtonProps } from "./Button";
import { cx } from "./classNames";
import { Input, type InputProps } from "./Input";
import { Textarea, type TextareaProps } from "./Textarea";
import * as styles from "./Dialog.css";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  cardClassName?: string;
  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  onBackdropClick?: MouseEventHandler<HTMLButtonElement>;
};

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  contentClassName,
  cardClassName,
  backdropClassName,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  onBackdropClick,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={cx(styles.overlay, "ds-modal", className)}
      data-overlay-root="dialog"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <button
        type="button"
        className={cx(styles.backdrop, "ds-modal-backdrop", backdropClassName)}
        data-ui-dialog-backdrop="true"
        data-overlay-phase="backdrop"
        aria-label="Close dialog"
        onClick={(event) => {
          onBackdropClick?.(event);
          if (!event.defaultPrevented) {
            onOpenChange(false);
          }
        }}
      />
      <div
        className={cx(styles.content, "ds-modal-card", cardClassName, contentClassName)}
        data-ui-dialog-card="true"
        data-overlay-phase="surface"
        data-overlay-treatment="translucent"
      >
        {children}
      </div>
    </div>
  );
}

export type DialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={cx(styles.header, className)}>{children}</div>;
}

export type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  return (
    <h2 {...props} className={cx(styles.title, "ds-modal-title", className)}>
      {children}
    </h2>
  );
}

export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  return (
    <p {...props} className={cx(styles.description, "ds-modal-subtitle", className)}>
      {children}
    </p>
  );
}

export type DialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
  return <div className={cx(styles.footer, "ds-modal-actions", className)}>{children}</div>;
}

export type DialogLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function DialogLabel({ className, htmlFor, ...props }: DialogLabelProps) {
  return <label {...props} htmlFor={htmlFor} className={cx("ds-modal-label", className)} />;
}

export type DialogLabelTextProps = HTMLAttributes<HTMLSpanElement>;

export function DialogLabelText({ className, ...props }: DialogLabelTextProps) {
  return <span {...props} className={cx("ds-modal-label", className)} />;
}

export type DialogInputProps = InputProps;

export const DialogInput = forwardRef<HTMLInputElement, DialogInputProps>(function DialogInput(
  { fieldClassName, ...props },
  ref
) {
  return <Input {...props} ref={ref} fieldClassName={cx("ds-modal-input", fieldClassName)} />;
});

export type DialogTextareaProps = TextareaProps;

export const DialogTextarea = forwardRef<HTMLTextAreaElement, DialogTextareaProps>(
  function DialogTextarea({ className, ...props }, ref) {
    return <Textarea {...props} ref={ref} className={cx("ds-modal-textarea", className)} />;
  }
);

export const DialogButton = forwardRef<HTMLButtonElement, ButtonProps>(function DialogButton(
  { className, ...props },
  ref
) {
  return <Button {...props} ref={ref} className={cx("ds-modal-button", className)} />;
});

export type DialogDividerProps = HTMLAttributes<HTMLDivElement>;

export function DialogDivider({ className, ...props }: DialogDividerProps) {
  return <div {...props} className={cx("ds-modal-divider", className)} />;
}

export type DialogErrorProps = HTMLAttributes<HTMLDivElement>;

export function DialogError({ className, ...props }: DialogErrorProps) {
  return <div {...props} className={cx("ds-modal-error", className)} />;
}
