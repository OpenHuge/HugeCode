import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { cx } from "./classNames";
import { Field, joinFieldMessageIds } from "./Field";
import * as styles from "./Input.css";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "prefix" | "size"
> {
  label?: ReactNode;
  fieldClassName?: string;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  inputSize?: "sm" | "md" | "lg";
  prefix?: ReactNode;
  suffix?: ReactNode;
  onValueChange?: (value: string) => void;
}

function hasInputValue(value: InputHTMLAttributes<HTMLInputElement>["value"]) {
  if (typeof value === "number") {
    return true;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return Array.isArray(value) ? value.length > 0 : false;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    description,
    defaultValue,
    errorMessage,
    fieldClassName,
    id,
    inputSize = "md",
    invalid = false,
    label,
    onChange,
    onValueChange,
    prefix,
    suffix,
    value,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? `ds-input-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = errorMessage ? `${inputId}-error` : undefined;
  const describedBy = joinFieldMessageIds(descriptionId, errorId);
  const [hasValue, setHasValue] = useState(() => hasInputValue(value ?? defaultValue));

  useEffect(() => {
    setHasValue(hasInputValue(value ?? defaultValue));
  }, [defaultValue, value]);

  return (
    <Field
      label={label}
      htmlFor={inputId}
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <div
        className={cx(
          styles.field,
          styles.size[inputSize],
          fieldClassName,
          invalid && styles.fieldInvalid,
          props.disabled && styles.fieldDisabled,
          props.readOnly && styles.fieldReadonly
        )}
        data-has-prefix={prefix ? "true" : undefined}
        data-has-suffix={suffix ? "true" : undefined}
        data-invalid={invalid ? "true" : "false"}
        data-disabled={props.disabled ? "true" : "false"}
        data-readonly={props.readOnly ? "true" : undefined}
        data-input-size={inputSize}
        data-has-value={hasValue ? "true" : "false"}
      >
        {prefix ? <span className={styles.affix}>{prefix}</span> : null}
        <input
          {...props}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          id={inputId}
          className={cx(styles.control, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setHasValue(hasInputValue(event.currentTarget.value));
            onChange?.(event);
            onValueChange?.(event.currentTarget.value);
          }}
        />
        {suffix ? <span className={styles.affix}>{suffix}</span> : null}
      </div>
    </Field>
  );
});
