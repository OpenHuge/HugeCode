import {
  Dialog as SharedDialog,
  DialogButton as SharedDialogButton,
  DialogDescription as SharedDialogDescription,
  DialogDivider as SharedDialogDivider,
  DialogError as SharedDialogError,
  DialogFooter as SharedDialogFooter,
  DialogHeader as SharedDialogHeader,
  DialogInput as SharedDialogInput,
  DialogLabel as SharedDialogLabel,
  DialogLabelText as SharedDialogLabelText,
  type DialogProps as SharedDialogProps,
  DialogTextarea as SharedDialogTextarea,
  DialogTitle as SharedDialogTitle,
} from "@ku0/design-system";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

function withAppClassName(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type DialogProps = SharedDialogProps;

export function Dialog({ cardClassName, className, ...props }: DialogProps) {
  return (
    <SharedDialog
      {...props}
      className={withAppClassName("app-dialog-root", className)}
      cardClassName={withAppClassName("app-dialog-card", cardClassName)}
    />
  );
}

export type DialogHeaderProps = ComponentPropsWithoutRef<typeof SharedDialogHeader>;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <SharedDialogHeader {...props} className={withAppClassName("app-dialog-header", className)} />
  );
}

export type DialogTitleProps = ComponentPropsWithoutRef<typeof SharedDialogTitle>;

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <SharedDialogTitle {...props} className={withAppClassName("app-dialog-title", className)} />
  );
}

export type DialogDescriptionProps = ComponentPropsWithoutRef<typeof SharedDialogDescription>;

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <SharedDialogDescription
      {...props}
      className={withAppClassName("app-dialog-description", className)}
    />
  );
}

export type DialogFooterProps = ComponentPropsWithoutRef<typeof SharedDialogFooter>;

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <SharedDialogFooter {...props} className={withAppClassName("app-dialog-footer", className)} />
  );
}

export type DialogLabelProps = ComponentPropsWithoutRef<typeof SharedDialogLabel>;

export function DialogLabel({ className, ...props }: DialogLabelProps) {
  return (
    <SharedDialogLabel {...props} className={withAppClassName("app-dialog-label", className)} />
  );
}

export type DialogLabelTextProps = ComponentPropsWithoutRef<typeof SharedDialogLabelText>;

export function DialogLabelText({ className, ...props }: DialogLabelTextProps) {
  return (
    <SharedDialogLabelText
      {...props}
      className={withAppClassName("app-dialog-label-text", className)}
    />
  );
}

export type DialogInputProps = ComponentPropsWithoutRef<typeof SharedDialogInput>;

export const DialogInput = forwardRef<HTMLInputElement, DialogInputProps>(function DialogInput(
  { fieldClassName, ...props },
  ref
) {
  return (
    <SharedDialogInput
      {...props}
      ref={ref}
      fieldClassName={withAppClassName("app-dialog-input", fieldClassName)}
    />
  );
});

export type DialogTextareaProps = ComponentPropsWithoutRef<typeof SharedDialogTextarea>;

export const DialogTextarea = forwardRef<HTMLTextAreaElement, DialogTextareaProps>(
  function DialogTextarea({ className, ...props }, ref) {
    return (
      <SharedDialogTextarea
        {...props}
        ref={ref}
        className={withAppClassName("app-dialog-textarea", className)}
      />
    );
  }
);

export type DialogButtonProps = ComponentPropsWithoutRef<typeof SharedDialogButton>;

export const DialogButton = forwardRef<HTMLButtonElement, DialogButtonProps>(function DialogButton(
  { className, ...props },
  ref
) {
  return (
    <SharedDialogButton
      {...props}
      ref={ref}
      className={withAppClassName("app-dialog-button", className)}
    />
  );
});

export type DialogDividerProps = ComponentPropsWithoutRef<typeof SharedDialogDivider>;

export function DialogDivider({ className, ...props }: DialogDividerProps) {
  return (
    <SharedDialogDivider {...props} className={withAppClassName("app-dialog-divider", className)} />
  );
}

export type DialogErrorProps = ComponentPropsWithoutRef<typeof SharedDialogError>;

export function DialogError({ className, ...props }: DialogErrorProps) {
  return (
    <SharedDialogError {...props} className={withAppClassName("app-dialog-error", className)} />
  );
}
