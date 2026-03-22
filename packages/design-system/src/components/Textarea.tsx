import { forwardRef, type ReactNode, type TextareaHTMLAttributes, useId } from "react";
import { cx } from "./classNames";
import { Field, joinFieldMessageIds } from "./Field";
import * as styles from "./Textarea.css";

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children"
> {
  label?: ReactNode;
  fieldClassName?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  textareaSize?: "sm" | "md" | "lg";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    description,
    errorMessage,
    fieldClassName,
    id,
    invalid = false,
    label,
    rows = 4,
    textareaSize = "md",
    ...props
  },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? `ds-textarea-${generatedId}`;
  const descriptionId = description ? `${textareaId}-description` : undefined;
  const errorId = errorMessage ? `${textareaId}-error` : undefined;

  return (
    <Field
      className={fieldClassName}
      label={label}
      htmlFor={textareaId}
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <textarea
        {...props}
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cx(
          styles.control,
          styles.size[textareaSize],
          invalid && styles.invalid,
          className
        )}
        aria-invalid={invalid || undefined}
        aria-describedby={joinFieldMessageIds(descriptionId, errorId)}
      />
    </Field>
  );
});
