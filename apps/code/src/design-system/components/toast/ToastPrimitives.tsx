import {
  ToastActions as SharedToastActions,
  ToastBody as SharedToastBody,
  ToastCard as SharedToastCard,
  ToastError as SharedToastError,
  ToastHeader as SharedToastHeader,
  ToastTitle as SharedToastTitle,
  ToastViewport as SharedToastViewport,
} from "@ku0/design-system";
import type { AriaRole, ComponentPropsWithoutRef, ReactNode } from "react";
import { joinClassNames } from "../../../utils/classNames";

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
    <SharedToastViewport
      className={joinClassNames("ds-toast-viewport", className)}
      role={role}
      ariaLive={ariaLive}
      data-desktop-drag-region="false"
      {...props}
    >
      {children}
    </SharedToastViewport>
  );
}

type ToastCardProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "role"> & {
  children: ReactNode;
  className?: string;
  role?: AriaRole;
  tone?: "info" | "success" | "warning" | "error";
};

export function ToastCard({ children, className, role, tone, ...props }: ToastCardProps) {
  return (
    <SharedToastCard
      className={joinClassNames("ds-toast-card", className)}
      role={role}
      tone={tone}
      data-desktop-drag-region="false"
      {...props}
    >
      {children}
    </SharedToastCard>
  );
}

type ToastTextProps = ComponentPropsWithoutRef<"div">;

export function ToastTitle({ className, ...props }: ToastTextProps) {
  return <SharedToastTitle className={joinClassNames("ds-toast-title", className)} {...props} />;
}

export function ToastBody({ className, ...props }: ToastTextProps) {
  return <SharedToastBody className={joinClassNames("ds-toast-body", className)} {...props} />;
}

type ToastSectionProps = ComponentPropsWithoutRef<"div">;

export function ToastHeader({ className, ...props }: ToastSectionProps) {
  return <SharedToastHeader className={joinClassNames("ds-toast-header", className)} {...props} />;
}

export function ToastActions({ className, ...props }: ToastSectionProps) {
  return (
    <SharedToastActions className={joinClassNames("ds-toast-actions", className)} {...props} />
  );
}

type ToastErrorProps = ComponentPropsWithoutRef<"pre">;

export function ToastError({ className, ...props }: ToastErrorProps) {
  return <SharedToastError className={joinClassNames("ds-toast-error", className)} {...props} />;
}
