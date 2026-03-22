import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { Field, joinFieldMessageIds } from "./Field";
import * as styles from "./Checkbox.css";
import { cx } from "./classNames";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "size" | "type"
> {
  label: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  invalid?: boolean;
  indeterminate?: boolean;
  inputClassName?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    className,
    description,
    errorMessage,
    id,
    inputClassName,
    indeterminate = false,
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
  const inputId = id ?? `ds-checkbox-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = errorMessage ? `${inputId}-error` : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <Field
      description={description}
      descriptionId={descriptionId}
      errorMessage={errorMessage}
      errorId={errorId}
    >
      <label
        className={cx(styles.root, className)}
        htmlFor={inputId}
        data-checked={props.checked ? "true" : "false"}
        data-disabled={props.disabled ? "true" : "false"}
        data-invalid={invalid ? "true" : "false"}
        data-indeterminate={indeterminate ? "true" : "false"}
      >
        <input
          {...props}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          id={inputId}
          type="checkbox"
          className={cx(styles.input, invalid && styles.inputInvalid, inputClassName)}
          aria-invalid={invalid || undefined}
          aria-describedby={joinFieldMessageIds(descriptionId, errorId)}
          onChange={(event) => {
            onChange?.(event);
            onCheckedChange?.(event.currentTarget.checked);
          }}
        />
        <span className={styles.copy}>
          <span className={cx(styles.labelText, labelClassName)}>{label}</span>
        </span>
      </label>
    </Field>
  );
});
