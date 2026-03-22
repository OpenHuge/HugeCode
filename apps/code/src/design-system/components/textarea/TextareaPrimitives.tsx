import {
  Textarea as SharedTextarea,
  type TextareaProps as SharedTextareaProps,
} from "@ku0/design-system";
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { joinClassNames } from "../../../utils/classNames";

export interface TextareaProps
  extends Omit<SharedTextareaProps, "invalid">, TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  textareaSize?: SharedTextareaProps["textareaSize"];
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, fieldClassName, textareaSize = "lg", ...props }, ref) => {
    return (
      <SharedTextarea
        {...props}
        ref={ref}
        className={joinClassNames("app-textarea-control", className)}
        fieldClassName={joinClassNames("app-textarea-field", fieldClassName)}
        invalid={error}
        textareaSize={textareaSize}
        data-app-textarea="true"
      />
    );
  }
);

Textarea.displayName = "Textarea";
