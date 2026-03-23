import { forwardRef, type HTMLAttributes, type PropsWithChildren, type ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "subtle" | "translucent" | "ghost";
  variant?: "default" | "subtle" | "translucent" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  selected?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, PropsWithChildren<CardProps>>(function Card(
  {
    children,
    className,
    footer,
    header,
    interactive = false,
    padding = "md",
    selected = false,
    tone = "default",
    variant,
    ...props
  },
  ref
) {
  const resolvedTone = variant ?? tone;

  return (
    <div
      {...props}
      ref={ref}
      className={cx(
        styles.root,
        styles.tone[resolvedTone],
        styles.padding[padding],
        interactive && styles.interactive,
        selected && styles.selected,
        className
      )}
      data-tone={resolvedTone}
    >
      {header ? <div className={styles.header}>{header}</div> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
});

export function CardHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx(styles.header, className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx(styles.body, className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx(styles.footer, className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 {...props} className={cx(styles.title, className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...props} className={cx(styles.description, className)}>
      {children}
    </p>
  );
}
