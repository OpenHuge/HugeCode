import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { ShellFrame } from "../../../design-system";
import * as styles from "./SidebarScaffold.css";

function joinClassName(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const SidebarFrame = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement> & { children: ReactNode }
>(function SidebarFrame({ children, className, ...props }, ref) {
  return (
    <ShellFrame
      {...props}
      ref={ref}
      as="aside"
      className={joinClassName(styles.frame, className)}
      data-sidebar-frame="true"
      padding="none"
      tone="ghost"
    >
      {children}
    </ShellFrame>
  );
});

export function SidebarHeaderFrame({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.header, className)} data-sidebar-header="true">
      {children}
    </div>
  );
}

export const SidebarBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { children: ReactNode }
>(function SidebarBody({ children, className, ...props }, ref) {
  return (
    <div
      {...props}
      ref={ref}
      className={joinClassName(styles.body, className)}
      data-sidebar-body="true"
    >
      {children}
    </div>
  );
});

export function SidebarSection({
  children,
  className,
  section,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; section: string }) {
  return (
    <div
      {...props}
      className={joinClassName(styles.section, className)}
      data-sidebar-section={section}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.footer, className)} data-sidebar-footer="true">
      {children}
    </div>
  );
}

export function SidebarRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={joinClassName(styles.row, className)} data-sidebar-row="true">
      {children}
    </div>
  );
}
