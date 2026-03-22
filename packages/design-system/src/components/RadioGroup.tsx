import { type InputHTMLAttributes, type ReactNode, useId, useMemo, useState } from "react";
import { Field, joinFieldMessageIds } from "./Field";
import { cx } from "./classNames";
import * as styles from "./RadioGroup.css";

export interface RadioGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  leadingLabel?: ReactNode;
}

export interface RadioGroupProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "size" | "type" | "value" | "defaultValue" | "onChange"
> {
  options: RadioGroupOption[];
  value?: string;
  defaultValue?: string;
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  groupClassName?: string;
  optionClassName?: string;
  orientation?: "vertical" | "horizontal";
  variant?: "default" | "card";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  onValueChange?: (value: string) => void;
}

export function RadioGroup({
  "aria-describedby": ariaDescribedByProp,
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  defaultValue,
  description,
  disabled = false,
  errorMessage,
  groupClassName,
  invalid = false,
  label,
  name,
  onChange,
  onValueChange,
  optionClassName,
  options,
  orientation = "vertical",
  value,
  variant = "default",
  ...props
}: RadioGroupProps) {
  const generatedId = useId();
  const groupName = name ?? `ds-radio-group-${generatedId}`;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const currentValue = value ?? uncontrolledValue;
  const labelId = label ? `${groupName}-label` : undefined;
  const descriptionId = description ? `${groupName}-description` : undefined;
  const errorId = errorMessage ? `${groupName}-error` : undefined;
  const describedBy = joinFieldMessageIds(
    descriptionId,
    errorId,
    ariaDescribedBy,
    ariaDescribedByProp
  );
  const resolvedAriaLabelledBy = useMemo(
    () => joinFieldMessageIds(labelId, ariaLabelledBy),
    [ariaLabelledBy, labelId]
  );

  return (
    <Field
      label={label ? <span id={labelId}>{label}</span> : undefined}
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <div
        role="radiogroup"
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cx(
          styles.group,
          orientation === "horizontal" && styles.groupHorizontal,
          groupClassName
        )}
      >
        {options.map((option) => {
          const optionId = `${groupName}-${option.value}`;
          const optionLabelId = `${optionId}-label`;
          const optionDescriptionId = option.description ? `${optionId}-description` : undefined;
          const checked = currentValue === option.value;
          const optionDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              className={cx(
                styles.option,
                styles.variantStyles[variant],
                optionDisabled && styles.optionDisabled,
                optionClassName
              )}
              data-checked={checked ? "true" : "false"}
              data-disabled={optionDisabled ? "true" : "false"}
              data-invalid={invalid ? "true" : "false"}
            >
              <input
                {...props}
                id={optionId}
                className={styles.input}
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                disabled={optionDisabled}
                aria-invalid={invalid || undefined}
                aria-labelledby={optionLabelId}
                aria-describedby={joinFieldMessageIds(optionDescriptionId)}
                onChange={(event) => {
                  if (value === undefined) {
                    setUncontrolledValue(event.currentTarget.value);
                  }
                  onChange?.(event);
                  onValueChange?.(event.currentTarget.value);
                }}
              />
              {variant === "card" && option.leadingLabel ? (
                <span className={styles.leading} aria-hidden>
                  {option.leadingLabel}
                </span>
              ) : null}
              <span className={styles.control} aria-hidden>
                <span className={styles.dot} />
              </span>
              <span className={styles.content}>
                <span className={styles.labelText} id={optionLabelId}>
                  {option.label}
                </span>
                {option.description ? (
                  <span className={styles.description} id={optionDescriptionId}>
                    {option.description}
                  </span>
                ) : null}
              </span>
              {variant === "card" ? (
                <span className={styles.trailingIndicator} aria-hidden>
                  ✓
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </Field>
  );
}
