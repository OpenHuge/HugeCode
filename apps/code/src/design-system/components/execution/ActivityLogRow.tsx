import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";
import type { ExecutionTone } from "./executionStatus";
import * as styles from "./ExecutionPrimitives.css";

type ActivityLogRowProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: ExecutionTone;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
};

export function ActivityLogRow({
  tone = "neutral",
  icon,
  title,
  description,
  meta,
  actions,
  body,
  footer,
  interactive = false,
  selected = false,
  disabled = false,
  className,
  ...props
}: ActivityLogRowProps) {
  return (
    <div
      className={joinClassNames(
        styles.executionRow,
        styles.executionRowTone[tone],
        interactive ? styles.executionRowInteractive : null,
        selected ? styles.executionRowSelected : null,
        disabled ? styles.executionRowDisabled : null,
        className
      )}
      aria-disabled={disabled || undefined}
      {...props}
    >
      <div className={styles.executionRowHeader}>
        <div className={styles.executionRowLead}>
          {icon ? (
            <span className={styles.executionRowIcon} aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className={styles.executionRowTitleStack}>
            <div className={styles.executionRowTitle}>{title}</div>
            {description ? (
              <div className={styles.executionRowDescription}>{description}</div>
            ) : null}
            {meta ? <div className={styles.executionRowMeta}>{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className={styles.executionRowActions}>{actions}</div> : null}
      </div>
      {body ? <div className={styles.executionRowBody}>{body}</div> : null}
      {footer ? <div className={styles.executionRowFooter}>{footer}</div> : null}
    </div>
  );
}
