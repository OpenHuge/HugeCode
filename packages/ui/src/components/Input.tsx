import { Input as SharedInput } from "@ku0/design-system";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | undefined;
  helperText?: string;
  inputSize?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, inputSize = "md", ...props }, ref) => {
    return (
      <SharedInput
        {...props}
        ref={ref}
        className={className}
        label={label}
        description={error ? undefined : helperText}
        errorMessage={error}
        invalid={Boolean(error)}
        inputSize={inputSize}
      />
    );
  }
);

Input.displayName = "Input";
