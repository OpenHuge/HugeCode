import { forwardRef, type InputHTMLAttributes, type ReactNode, useId, useState } from "react";
import { Field, joinFieldMessageIds } from "./Field";
import * as styles from "./Switch.css";
import { cx } from "./classNames";

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "size" | "type"
> {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  controlClassName?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    checked,
    className,
    controlClassName,
    defaultChecked,
    description,
    disabled = false,
    errorMessage,
    id,
    invalid = false,
    label,
    labelClassName,
    onChange,
    onCheckedChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? `ds-switch-${generatedId}`;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
  const currentChecked = checked ?? uncontrolledChecked;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = errorMessage ? `${inputId}-error` : undefined;

  return (
    <Field
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <label
        className={cx(styles.root, disabled && styles.disabled, className)}
        htmlFor={inputId}
        data-checked={currentChecked ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        data-invalid={invalid ? "true" : "false"}
      >
        {label ? (
          <span className={styles.copy}>
            <span className={cx(styles.labelText, labelClassName)}>{label}</span>
          </span>
        ) : null}
        <span className={cx(styles.control, controlClassName)}>
          <input
            {...props}
            ref={ref}
            id={inputId}
            type="checkbox"
            role="switch"
            checked={currentChecked}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={joinFieldMessageIds(descriptionId, errorId)}
            className={styles.input}
            onChange={(event) => {
              if (checked === undefined) {
                setUncontrolledChecked(event.currentTarget.checked);
              }
              onChange?.(event);
              onCheckedChange?.(event.currentTarget.checked);
            }}
          />
          <span aria-hidden className={styles.track}>
            <span className={styles.thumb} />
          </span>
        </span>
      </label>
    </Field>
  );
});
