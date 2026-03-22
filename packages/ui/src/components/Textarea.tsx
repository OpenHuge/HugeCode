import { Textarea as SharedTextarea } from "@ku0/design-system";
import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | undefined;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <SharedTextarea
        {...props}
        ref={ref}
        className={className}
        label={label}
        description={error ? undefined : helperText}
        errorMessage={error}
        invalid={Boolean(error)}
      />
    );
  }
);

Textarea.displayName = "Textarea";
