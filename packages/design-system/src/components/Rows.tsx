import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./classNames";
import { Text } from "./Text";
import * as styles from "./Rows.css";

export interface MetadataListProps extends HTMLAttributes<HTMLDivElement> {}

export function MetadataList({ children, className, ...props }: MetadataListProps) {
  return (
    <div {...props} className={cx(styles.metadataList, className)}>
      {children}
    </div>
  );
}

export interface MetadataRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
}

export function MetadataRow({ label, value, className, ...props }: MetadataRowProps) {
  return (
    <div {...props} className={cx(styles.metadataRow, className)}>
      <Text
        as="div"
        className={styles.metadataLabel}
        size="fine"
        tone="muted"
        weight="medium"
        transform="uppercase"
      >
        {label}
      </Text>
      <Text as="div" className={styles.metadataValue} size="meta" tone="strong">
        {value}
      </Text>
    </div>
  );
}

export interface InlineActionRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function InlineActionRow({
  label,
  description,
  action,
  className,
  ...props
}: InlineActionRowProps) {
  return (
    <div {...props} className={cx(styles.inlineActionRow, className)}>
      <div className={styles.inlineActionCopy}>
        <Text
          as="div"
          className={styles.inlineActionLabel}
          size="meta"
          tone="strong"
          weight="semibold"
        >
          {label}
        </Text>
        {description ? (
          <Text as="div" className={styles.inlineActionDescription} size="fine" tone="muted">
            {description}
          </Text>
        ) : null}
      </div>
      {action}
    </div>
  );
}
