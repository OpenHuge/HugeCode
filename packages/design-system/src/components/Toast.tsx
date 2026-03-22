import type { AriaRole, ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./classNames";
import * as styles from "./Toast.css";

export type ToastTone = "info" | "success" | "warning" | "error";

type ToastViewportProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> & {
  children: ReactNode;
  className?: string;
  role?: AriaRole;
  ariaLive?: "off" | "polite" | "assertive";
};

export function ToastViewport({
  children,
  className,
  role,
  ariaLive,
  ...props
}: ToastViewportProps) {
  return (
    <div className={cx(styles.viewport, className)} role={role} aria-live={ariaLive} {...props}>
      {children}
    </div>
  );
}

type ToastCardProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> & {
  children: ReactNode;
  className?: string;
  role?: AriaRole;
  tone?: ToastTone;
};

export function ToastCard({ children, className, role, tone = "info", ...props }: ToastCardProps) {
  return (
    <div className={cx(styles.card, styles.cardTone[tone], className)} role={role} {...props}>
      {children}
    </div>
  );
}

type ToastSectionProps = ComponentPropsWithoutRef<"div">;

export function ToastHeader({ className, ...props }: ToastSectionProps) {
  return <div className={cx(styles.header, className)} {...props} />;
}

export function ToastActions({ className, ...props }: ToastSectionProps) {
  return <div className={cx(styles.actions, className)} {...props} />;
}

type ToastTextProps = ComponentPropsWithoutRef<"div">;

export function ToastTitle({ className, ...props }: ToastTextProps) {
  return <div className={cx(styles.title, className)} {...props} />;
}

export function ToastBody({ className, ...props }: ToastTextProps) {
  return <div className={cx(styles.body, className)} {...props} />;
}

type ToastErrorProps = ComponentPropsWithoutRef<"pre">;

export function ToastError({ className, ...props }: ToastErrorProps) {
  return <pre className={cx(styles.error, className)} {...props} />;
}
