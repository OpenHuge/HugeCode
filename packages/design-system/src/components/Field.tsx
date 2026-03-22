import type { ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Field.css";

export function joinFieldMessageIds(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ") || undefined;
}

export interface FieldProps {
  children: ReactNode;
  label?: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  descriptionId?: string;
  errorMessage?: ReactNode;
  errorId?: string;
  className?: string;
}

export function Field({
  children,
  className,
  description,
  descriptionId,
  errorId,
  errorMessage,
  htmlFor,
  label,
}: FieldProps) {
  return (
    <div className={cx(styles.root, className)}>
      {label ? (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {description || errorMessage ? (
        <div className={styles.messages}>
          {description ? (
            <div id={descriptionId} className={styles.description}>
              {description}
            </div>
          ) : null}
          {errorMessage ? (
            <div id={errorId} className={styles.errorMessage}>
              {errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
