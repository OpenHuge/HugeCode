import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import { ShellFrame, ShellToolbar, Surface } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import * as styles from "./ComposerShell.css";

type ComposerVariant = "thread" | "home" | "workspace";

type ComposerFrameProps = Omit<ComponentPropsWithoutRef<typeof ShellFrame>, "children"> & {
  children: ReactNode;
  variant: ComposerVariant;
  disabled?: boolean;
};

export function ComposerFrame({
  children,
  className,
  disabled = false,
  tone = "ghost",
  padding = "none",
  variant,
  ...props
}: ComposerFrameProps) {
  return (
    <ShellFrame
      {...props}
      as="footer"
      className={joinClassNames(
        "composer",
        disabled && "is-disabled",
        `composer--${variant}`,
        className
      )}
      data-composer-frame="true"
      data-composer-variant={variant}
      padding={padding}
      tone={tone}
    >
      {children}
    </ShellFrame>
  );
}

type ComposerScaffoldSlotProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ComposerToolbar({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <div
      {...props}
      className={joinClassNames(styles.passthrough, className)}
      data-composer-toolbar="true"
    >
      {children}
    </div>
  );
}

export function ComposerPendingPanel({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <div
      {...props}
      className={joinClassNames(styles.passthrough, className)}
      data-composer-pending-panel="true"
    >
      {children}
    </div>
  );
}

export function ComposerActionRail({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <div
      {...props}
      className={joinClassNames(styles.passthrough, className)}
      data-composer-action-rail="true"
    >
      {children}
    </div>
  );
}

export function ComposerDraftZone({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <div {...props} className={joinClassNames(className)} data-composer-draft-zone="true">
      {children}
    </div>
  );
}

export function ComposerAttachmentsTray({
  children,
  className,
  ...props
}: ComposerScaffoldSlotProps) {
  return (
    <div {...props} className={joinClassNames(className)} data-composer-attachments-tray="true">
      {children}
    </div>
  );
}

export function ComposerQueuePanel({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <Surface
      {...props}
      className={joinClassNames(className)}
      data-composer-queue-panel="true"
      padding="none"
      tone="ghost"
    >
      {children}
    </Surface>
  );
}

export function ComposerFooterBar({ children, className, ...props }: ComposerScaffoldSlotProps) {
  return (
    <Surface
      {...props}
      className={joinClassNames(styles.passthrough, className)}
      data-composer-footer-bar="true"
      padding="none"
      tone="ghost"
    >
      {children}
    </Surface>
  );
}

type ComposerWorkspaceFooterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ComposerWorkspaceFooter({
  className,
  leading,
  trailing,
  ...props
}: ComposerWorkspaceFooterProps) {
  return (
    <ShellToolbar
      {...props}
      className={joinClassNames(className)}
      data-composer-workspace-footer="true"
      leading={leading}
      trailing={trailing}
    />
  );
}
