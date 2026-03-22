import {
  ShellFrame as SharedShellFrame,
  ShellSection as SharedShellSection,
  ShellToolbar as SharedShellToolbar,
  SplitPanel as SharedSplitPanel,
  type ShellFrameProps as SharedShellFrameProps,
  type ShellSectionProps as SharedShellSectionProps,
  type ShellToolbarProps as SharedShellToolbarProps,
  type SplitPanelProps as SharedSplitPanelProps,
} from "@ku0/design-system";
import { forwardRef } from "react";

function withAppClassName(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface ShellFrameProps extends SharedShellFrameProps {}

export const ShellFrame = forwardRef<HTMLElement, ShellFrameProps>(function ShellFrame(
  { className, ...props },
  ref
) {
  return (
    <SharedShellFrame
      {...props}
      ref={ref}
      className={withAppClassName("app-shell-frame", className)}
    />
  );
});

export interface ShellSectionProps extends SharedShellSectionProps {}

export function ShellSection({
  bodyClassName,
  className,
  headerClassName,
  titleClassName,
  ...props
}: ShellSectionProps) {
  return (
    <SharedShellSection
      {...props}
      className={withAppClassName("app-shell-section", className)}
      headerClassName={withAppClassName("app-shell-section-header", headerClassName)}
      titleClassName={withAppClassName("app-shell-section-title", titleClassName)}
      bodyClassName={withAppClassName("app-shell-section-body", bodyClassName)}
    />
  );
}

export interface ShellToolbarProps extends SharedShellToolbarProps {}

export function ShellToolbar({ className, ...props }: ShellToolbarProps) {
  return (
    <SharedShellToolbar {...props} className={withAppClassName("app-shell-toolbar", className)} />
  );
}

export interface SplitPanelProps extends SharedSplitPanelProps {}

export function SplitPanel({ className, ...props }: SplitPanelProps) {
  return <SharedSplitPanel {...props} className={withAppClassName("app-split-panel", className)} />;
}
