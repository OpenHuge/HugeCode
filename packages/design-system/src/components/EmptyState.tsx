import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./EmptyState.css";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({
  actions,
  className,
  description,
  eyebrow,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div {...props} className={cx(styles.root, className)}>
      {icon ? <div className={styles.iconWrap}>{icon}</div> : null}
      <div className={styles.copy}>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <div className={styles.title}>{title}</div>
        <div className={styles.description}>{description}</div>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
