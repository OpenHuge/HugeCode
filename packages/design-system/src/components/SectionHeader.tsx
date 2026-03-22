import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./classNames";
import { Text } from "./Text";
import * as styles from "./SectionHeader.css";

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  titleAs?: "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  meta?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
  metaClassName?: string;
  actionsClassName?: string;
}

export function SectionHeader({
  title,
  titleAs = "span",
  meta,
  actions,
  className,
  titleClassName,
  metaClassName,
  actionsClassName,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cx(styles.root, className)} {...props}>
      <Text
        as={titleAs}
        className={cx(styles.title, titleClassName)}
        size="meta"
        tone="faint"
        weight="semibold"
        transform="uppercase"
      >
        {title}
      </Text>
      {meta || actions ? (
        <div className={styles.side}>
          {meta ? (
            <Text as="span" className={cx(styles.meta, metaClassName)} size="meta" tone="faint">
              {meta}
            </Text>
          ) : null}
          {actions ? <div className={cx(styles.actions, actionsClassName)}>{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
